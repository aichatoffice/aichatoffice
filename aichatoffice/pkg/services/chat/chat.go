package chatsvc

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/gotomicro/ego/core/econf"
	"github.com/gotomicro/ego/core/elog"
	jsoniter "github.com/json-iterator/go"
	"github.com/spf13/cast"
	"go.uber.org/zap"

	"aichatoffice/pkg/models/dto"
	"aichatoffice/pkg/models/store"
	aisvc "aichatoffice/pkg/services/ai"
	"aichatoffice/pkg/utils"
)

type ChatSvc struct {
	chatStore store.ChatStore
	aiSvc     *aisvc.AiWrapper
}

func NewChatSvc(chatRepo store.ChatStore, aiSvc *aisvc.AiWrapper) *ChatSvc {
	RegisterContentHandler("text", NewContentText())
	return &ChatSvc{
		chatStore: chatRepo,
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

func (c ChatSvc) Chat(ctx context.Context, userId string, conversationId string, reqMsg dto.ChatMessage, regenMessageId string, event chan<- string) error {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	// try resume conversation
	_ = c.chatStore.ResumeConversation(ctx, userId, conversationId)
	// find all messages in conversation
	conversation, err := c.chatStore.GetConversation(ctx, userId, conversationId)
	if err != nil {
		elog.Error("get conversation failed", zap.Error(err), elog.FieldCtxTid(ctx))
		return err
	}
	if conversation.ConversationId == "" {
		elog.Error("no conversation found", elog.FieldCtxTid(ctx))
		return dto.ErrConversationNotFound
	}
	msgs := conversation.Messages
	system := conversation.System
	// filter ai message
	var aiMsgs []dto.ChatMessage
	for i := range msgs {
		if msgs[i].NeedAIChat {
			aiMsgs = append(aiMsgs, msgs[i].ChatMessage)
		}
	}
	var regenMsg dto.ChatMessage
	var needAI = true
	var retMsgs []dto.ChatMessage
	var streamMsgs = make(chan dto.ChatMessage)
	var retMessageId string
	if regenMessageId != "" {
		var found bool
		// find previous question message
		for i := len(aiMsgs) - 1; i >= 0; i-- {
			if aiMsgs[i].MessageId == regenMessageId {
				regenMsg = aiMsgs[i]
				aiMsgs = aiMsgs[:i]
				found = true
				retMessageId = regenMessageId
				break
			}
		}
		if !found {
			elog.Error("regen message not found", elog.FieldCtxTid(ctx))
			return dto.ErrRegenMessageNotFound
		}
	} else {
		// generate message id
		retMessageId, err = utils.NewGuid(16)
		if err != nil {
			elog.Error("generate message id failed", zap.Error(err), elog.FieldCtxTid(ctx))
			return err
		}
		// pre handle message
		c.preHandleMsg(&reqMsg, conversation)
		var respContents dto.ChatContents
		var action string
		for _, content := range reqMsg.Content {
			HandleCheck, ok := contentHandlerMap[string(content.Type)]
			if !ok {
				return dto.ErrContentHandle
			}
			handleRet, err := HandleCheck.Handle(ctx, userId, content, aiMsgs)
			if err != nil {
				if dto.IsApiErr(err) {
					return err
				}
				return dto.ErrContentHandle
			}
			if !handleRet.NeedAIChat {
				needAI = false
			}
			respContents = append(respContents, handleRet.ResponseMessageContents...)
			reqMsg.Text += handleRet.Text + "\n"
			action = handleRet.Action
		}
		ctx = context.WithValue(ctx, "action", action)

		if !needAI {
			messageId, _ := utils.NewGuid(16)
			go func() {
				streamMsgs <- dto.ChatMessage{
					MessageId:   messageId,
					Role:        dto.ChatMessageRoleAssistant,
					Type:        dto.ChatMessageTypeAnswer,
					SentenceId:  0,
					IsEnd:       true,
					IsTruncated: false,
					Content:     respContents,
					Text:        "",
					Created:     time.Now().UnixMilli(),
				}
				close(streamMsgs)
			}()
		}
		aiMsgs = append(aiMsgs, reqMsg)
	}
	if needAI {
		if aiMsgs[len(aiMsgs)-1].Usage == nil {
			aiMsgs[len(aiMsgs)-1].Usage = &dto.ChatMessageTokenUsage{}
		}
		// 计算token
		totalToken, err := c.aiSvc.Tokenizer(ctx, aiMsgs[len(aiMsgs)-1].Text)
		if err != nil {
			return err
		}
		aiMsgs[len(aiMsgs)-1].Usage.PromptTokens = totalToken
		aiMsgs[len(aiMsgs)-1].Usage.TotalTokens = totalToken
		// send messages to ai service todo 支持多种ai
		err = c.aiSvc.ChatStream(ctx, userId, system, aiMsgs, retMessageId, streamMsgs)
		if err != nil {
			return err
		}
	}
	// send event
	for msg := range streamMsgs {
		msgStr, _ := jsoniter.MarshalToString(msg)
		event <- msgStr
		retMsgs = append(retMsgs, msg)
		if msg.IsEnd {
			// close(event)
			break
		}
		// check is break
		if b, _ := c.chatStore.IsConversationBreak(ctx, userId, conversationId); b {
			cancel()
		}
	}
	ctx = context.WithoutCancel(ctx)
	// save messages
	if len(retMsgs) > 0 {
		msg := retMsgs[0]
		if msg.Usage == nil {
			msg.Usage = &dto.ChatMessageTokenUsage{}
		}
		if regenMessageId != "" {
			msg.Created = regenMsg.Created
		}
		for i := 1; i < len(retMsgs); i++ {
			if retMsgs[i].Usage != nil && retMsgs[i].Usage.CompletionTokens > 0 {
				msg.Usage.CompletionTokens = retMsgs[i].Usage.CompletionTokens
				msg.Usage.TotalTokens = retMsgs[i].Usage.TotalTokens
			}
			*msg.Content[0].Text += *retMsgs[i].Content[0].Text
		}
		msg.Text = c.getTextFromContents(msg.Content)

		if needAI && msg.Text == "" {
			// skip empty ai message
			return nil
		}
		if regenMessageId == "" {
			if reqMsg.Usage == nil {
				reqMsg.Usage = &dto.ChatMessageTokenUsage{}
			}
			reqMsg.Usage.PromptTokens = msg.Usage.PromptTokens
			// save question
			err = c.chatStore.AddMessage(ctx, userId, conversationId, dto.ChatMessageDO{ChatMessage: reqMsg, NeedAIChat: needAI})
			if err != nil {
				// ignore error
				return nil
			}
		}

		err = c.chatStore.AddMessage(ctx, userId, conversationId, dto.ChatMessageDO{ChatMessage: msg, NeedAIChat: needAI})
		if err != nil {
			// ignore error
			return nil
		}
	}
	return nil
}

func (c ChatSvc) GetConversation(ctx context.Context, userId string, conversationId string) (*dto.ChatConversation, error) {
	return c.chatStore.GetConversation(ctx, userId, conversationId)
}

func (c ChatSvc) DeleteConversation(ctx context.Context, userId string, conversationId string) error {
	return c.chatStore.DeleteConversation(ctx, userId, conversationId)
}

func (c ChatSvc) preHandleMsg(msg *dto.ChatMessage, conversation *dto.ChatConversation) {
	extTransform := econf.GetStringMap("chat.textProcessor.extTransform")

	// processor 处理
	for _, content := range msg.Content {
		if content.Type == dto.ChatContentTypeTextProcessor {
			if len(content.TextProcessor.Ext) > 0 {
				for extKey, transformMap := range extTransform {
					if extVal, ok := content.TextProcessor.Ext[extKey]; ok {
						transformMap, ok := transformMap.(map[string]interface{})
						if !ok {
							continue
						}
						if transformVal, ok := transformMap[cast.ToString(extVal)]; ok {
							content.TextProcessor.Ext[extKey] = transformVal
						}
					}
				}
			}
		}
	}
}

func (c ChatSvc) getTextFromContents(contents dto.ChatContents) string {
	text := ""
	if len(contents) == 0 {
		return text
	}
	for _, content := range contents {
		if content.Type == dto.ChatContentTypeText {
			if content.Text == nil {
				continue
			}
			text += *content.Text
		}
	}
	return text
}

var generatorSubTypMap = map[string]int32{
	"newdoc":       -2,
	"presentation": -10,
	"ppt":          -10,
}

type HandleResult struct {
	RequestMessageContents  dto.ChatContents
	ResponseMessageContents dto.ChatContents
	Text                    string
	NeedAIChat              bool
	NeedSaveMessage         bool
	Action                  string
}

var (
	contentHandlerMap = map[string]ContentHandler{}
)

func RegisterContentHandler(name string, handler ContentHandler) {
	contentHandlerMap[name] = handler
}

type ContentHandler interface {
	Handle(ctx context.Context, uid string, content dto.ChatContent, messages []dto.ChatMessage) (*HandleResult, error)
}

// 聊天框里聊天
type ContentText struct {
}

func NewContentText() *ContentText {
	return &ContentText{}
}

func (c ContentText) Handle(ctx context.Context, uid string, content dto.ChatContent, messages []dto.ChatMessage) (*HandleResult, error) {
	if content.Type != "text" {
		return nil, errors.New("invalid content type")
	}
	var ret = &HandleResult{}
	ret.NeedAIChat = true
	ret.NeedSaveMessage = true
	ret.RequestMessageContents = append(ret.RequestMessageContents, content)
	if content.Text == nil {
		ret.Text = ""
	} else {
		ret.Text = *content.Text
	}
	return ret, nil
}

// 还不知道，问前端
type ContentTextContext struct {
}

func NewContentTextContext() *ContentTextContext {
	return &ContentTextContext{}
}

func (c ContentTextContext) Handle(ctx context.Context, uid string, content dto.ChatContent, messages []dto.ChatMessage) (*HandleResult, error) {
	if content.Type != "text_context" {
		return nil, errors.New("invalid content type")
	}
	var ret = &HandleResult{}
	ret.NeedAIChat = true
	ret.NeedSaveMessage = true
	ret.RequestMessageContents = append(ret.RequestMessageContents, content)
	if content.TextContext == nil {
		ret.Text = ""
	} else {
		ret.Text = fmt.Sprintf("请阅读这段文本:\n%s", *content.TextContext)
	}
	return ret, nil
}
