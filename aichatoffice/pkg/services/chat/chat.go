package chatsvc

import (
	"context"

	"github.com/gotomicro/ego/core/econf"
	"github.com/gotomicro/ego/core/elog"
	"go.uber.org/zap"

	"aichatoffice/pkg/models/dto"
	"aichatoffice/pkg/models/store"
	"aichatoffice/pkg/models/streaming"
	aisvc "aichatoffice/pkg/services/ai"
	"aichatoffice/pkg/utils"
)

type ChatSvc struct {
	chatStore store.ChatStore
	aiSvc     aisvc.AiSvc
}

func NewChatSvc(chatStore store.ChatStore, aiSvc aisvc.AiSvc) *ChatSvc {
	return &ChatSvc{
		chatStore: chatStore,
		aiSvc:     aiSvc,
	}
}

func (c ChatSvc) NewConversation(ctx context.Context, userId string, system string, fileGuid string) (conversationId string, err error) {
	// generate conversation id
	conversationId, err = utils.NewGuid(16)
	if err != nil {
		elog.Error("generate conversation id failed", zap.Error(err), elog.FieldCtxTid(ctx))
		return "", err
	}
	// get default system message from config if system message is empty
	if system == "" {
		system = econf.GetString("userChat.defaultSystemMessage")
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

	err = c.chatStore.NewConversation(ctx, userId, conversationId, system, fileGuid)
	if err != nil {
		elog.Error("create conversation failed", zap.Error(err), elog.FieldCtxTid(ctx))
		return "", err
	}
	return conversationId, nil
}

// BreakConversation break conversation
func (c ChatSvc) BreakConversation(ctx context.Context, userId string, conversationId string) error {
	return c.chatStore.BreakConversation(ctx, userId, conversationId)
}

func (c ChatSvc) Chat(ctx context.Context, userId string, conversationId string, chatInput string, event chan<- string) error {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	// conversation, err := c.chatStore.GetConversation(ctx, userId, conversationId)
	// if err != nil {
	// 	elog.Error("get conversation failed", zap.Error(err), elog.FieldCtxTid(ctx))
	// 	return err
	// }
	// if conversation.ConversationId == "" {
	// 	elog.Error("no conversation found", elog.FieldCtxTid(ctx))
	// 	return dto.ErrConversationNotFound
	// }

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

	// 调用 ai
	c.aiSvc.CompletionsStream(chatInput, teeWriter)

	// 记到数据库
	go func() {
		response := teeWriter.GetBuffer().String()
		// todo 在这里入库
		// input是 user，response 是 assistant
		elog.Warn("input", zap.String("input", chatInput))
		elog.Warn("response", zap.String("response", response))
	}()

	return nil
}

func (c ChatSvc) GetConversation(ctx context.Context, userId string, conversationId string) (*dto.ChatConversation, error) {
	return c.chatStore.GetConversation(ctx, userId, conversationId)
}

func (c ChatSvc) DeleteConversation(ctx context.Context, userId string, conversationId string) error {
	return c.chatStore.DeleteConversation(ctx, userId, conversationId)
}
