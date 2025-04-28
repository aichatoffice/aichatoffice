package chatsvc

import (
	"context"
	"fmt"
	"net/http"

	"github.com/gotomicro/cetus/l"
	"github.com/gotomicro/ego/core/econf"
	"github.com/gotomicro/ego/core/elog"
	"go.uber.org/zap"

	"aichatoffice/pkg/models/dto"
	"aichatoffice/pkg/models/store"
	"aichatoffice/pkg/models/streaming"
	aisvc "aichatoffice/pkg/services/ai"
	officesvc "aichatoffice/pkg/services/office"
	"aichatoffice/pkg/utils"
)

type ChatSvc struct {
	chatStore store.ChatStore
	AiSvc     aisvc.AiSvc
	officeSvc officesvc.OfficeSvc
}

func NewChatSvc(chatStore store.ChatStore, aiSvc aisvc.AiSvc, officeSvc officesvc.OfficeSvc) *ChatSvc {
	return &ChatSvc{
		chatStore: chatStore,
		AiSvc:     aiSvc,
		officeSvc: officeSvc,
	}
}

// GetOrCreateConversation 获取或创建对话
func (c ChatSvc) GetOrCreateConversation(ctx context.Context, userId string, fileId string) (*dto.ChatConversation, error) {
	// 先尝试获取现有对话
	conversation, err := c.chatStore.GetFileConversation(ctx, userId, fileId)
	if err != nil {
		elog.Error("get conversation failed", zap.Error(err), elog.FieldCtxTid(ctx))
		return nil, err
	}

	// 如果对话已存在，直接返回
	if conversation != nil && conversation.ConversationId != "" {
		conversation.Messages, err = c.chatStore.GetMessages(ctx, conversation.ConversationId)
		if err != nil {
			elog.Error("get messages failed", zap.Error(err), elog.FieldCtxTid(ctx))
			return nil, err
		}
		return conversation, nil
	}

	conversationId, err := c.NewConversation(ctx, userId, fileId)
	if err != nil {
		elog.Error("create conversation failed", zap.Error(err), elog.FieldCtxTid(ctx))
		return nil, err
	}

	// 返回新创建的对话信息
	return &dto.ChatConversation{
		ConversationId: conversationId,
		FileGuid:       fileId,
		UserId:         userId,
		Messages:       []dto.ChatMessage{},
	}, nil
}

// NewConversation 创建对话
func (c ChatSvc) NewConversation(ctx context.Context, userId string, fileGuid string) (conversationId string, err error) {
	// generate conversation id
	conversationId, err = utils.NewGuid(16)
	if err != nil {
		elog.Error("generate conversation id failed", zap.Error(err), elog.FieldCtxTid(ctx))
		return "", err
	}

	// 限制数量
	if econf.GetInt("userChat.conversationLimit") > 0 {
		count, err := c.chatStore.CountConversation(ctx, userId)
		if err != nil {
			elog.Error("count conversation failed", zap.Error(err), elog.FieldCtxTid(ctx))
			return "", err
		}
		if count >= econf.GetInt("userChat.conversationLimit") {
			elog.Error("conversation count limit", elog.FieldCtxTid(ctx))
			return "", dto.ErrConversationLimitReached
		}
	}

	err = c.chatStore.NewConversation(ctx, userId, conversationId, fileGuid)
	if err != nil {
		elog.Error("create conversation failed", zap.Error(err), elog.FieldCtxTid(ctx))
		return "", err
	}
	return conversationId, nil
}

// Chat AIChat方法
func (c ChatSvc) Chat(ctx context.Context, userId string, conversationId string, chatInput string, event chan<- string, isFree bool) error {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	// todo 改成 workflow
	rawMsg := make(chan string)
	defer close(rawMsg)
	teeWriter := utils.NewTeeWriter(utils.NewChanWriter(rawMsg))

	// format 后才能返回
	go func() {
		for msg := range rawMsg {
			event <- streaming.FormatDataContent(msg, streaming.TextPart)
		}
		close(event)
	}()

	// 处理自定义 key
	// todo 改成自定义类型
	switch chatInput {
	case "summary":
		// 获取文件内容
		fileContent, err := c.officeSvc.GetFileContent(conversationId) // todo 改成文件 id
		if err != nil {
			elog.Error("get file content failed", zap.Error(err), elog.FieldCtxTid(ctx))
			return err
		}

		// tood 拼接 prompts
		chatInput = fmt.Sprintf("请总结以下内容：%s", fileContent)
	}

	// 调用 ai
	c.AiSvc.CompletionsStream(chatInput, teeWriter)

	// 记到数据库
	go func(userId string, conversationId string, isFree bool) {
		response := teeWriter.GetBuffer().String()

		// 获取现有对话
		conversation, err := c.chatStore.GetConversation(ctx, userId, conversationId)
		if err != nil {
			elog.Error("get conversation failed", zap.Error(err))
			return
		}
		if conversation == nil {
			elog.Error("conversation not found")
			return
		}

		// 追加新消息到现有对话

		messages := []dto.ChatMessage{
			{
				ConversationId: conversationId,
				Content:        chatInput,
				Parts: []dto.ContentPart{
					{
						Type: "text",
						Text: chatInput,
					},
				},
				Role: "user",
			},
			{
				ConversationId: conversationId,
				Content:        response,
				Parts: []dto.ContentPart{
					{
						Type: "text",
						Text: response,
					},
				},
				Role: "assistant",
			},
		}

		// 更新对话消息
		err = c.chatStore.AddMessages(ctx, conversationId, messages)
		if err != nil {
			elog.Error("update conversation messages failed",
				zap.Error(err),
				zap.String("conversationId", conversationId))
		}

		// 	免费次数更新
		if isFree {
			UserFreeTimes(userId)
		}
	}(userId, conversationId, isFree)

	return nil
}

// BreakConversation break conversation
func (c ChatSvc) BreakConversation(ctx context.Context, userId string, conversationId string) error {
	return c.chatStore.BreakConversation(ctx, userId, conversationId)
}

func (c ChatSvc) GetConversation(ctx context.Context, userId string, fileGuid string) (*dto.ChatConversation, error) {
	return c.chatStore.GetConversation(ctx, userId, fileGuid)
}

func (c ChatSvc) DeleteConversation(ctx context.Context, userId string, fileGuid string) error {
	return c.chatStore.DeleteConversation(ctx, userId, fileGuid)
}

func UserFreeTimes(userId string) {
	if userId == "" {
		elog.Error("userId not found:")
		return
	}
	// 请求免费次数信息
	req, err := http.NewRequest("PUT", fmt.Sprintf("http://localhost:9001/api/auth/%s/free", userId), nil)
	if err != nil {
		elog.Error("创建请求失败:", l.E(err))
		return
	}

	// 创建客户端
	client := &http.Client{}
	// 发送请求
	resp, err := client.Do(req)
	if err != nil {
		elog.Error("请求失败:", l.E(err))
		return
	}
	defer resp.Body.Close()
	return
}
