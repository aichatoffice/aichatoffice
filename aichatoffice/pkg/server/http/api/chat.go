package api

import (
	"errors"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gotomicro/ego/core/elog"
	"go.uber.org/zap"

	"aichatoffice/pkg/invoker"
)

// ContentPart 表示消息内容的一部分
type ContentPart struct {
	Type     string `json:"type"`                // 内容类型，如 "text" 或 "image"
	Text     string `json:"text,omitempty"`      // 文本内容
	ImageUrl string `json:"image_url,omitempty"` // 图片URL，可选
}

// ChatMessage 表示单个聊天消息
type ChatMessage struct {
	Role    string        `json:"role"`    // 角色，如 "user" 或 "assistant"
	Content string        `json:"content"` // 文本内容，通常是简化的内容
	Parts   []ContentPart `json:"parts"`   // 实际内容部分的数组
}

// ChatRequest 表示聊天请求
type ChatRequest struct {
	ConversationID string        `json:"conversationId"`
	Messages       []ChatMessage `json:"messages"`
	CustomKey      string        `json:"customKey"`
}

func Completions(ctx *gin.Context) {
	// 检查是否有ai配置
	aiConfigs, err := invoker.AiConfigSvc.GetAIConfig(ctx)
	if err != nil || len(aiConfigs) == 0 {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error() + ", 请先配置AI模型"})
		return
	}

	ctx.Writer.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
	ctx.Writer.Header().Set("Cache-Control", "no-cache")
	ctx.Writer.Header().Set("Connection", "keep-alive")
	ctx.Writer.Header().Set("Transfer-Encoding", "chunked")
	ctx.Writer.Header().Set("x-vercel-ai-data-stream", "v1")

	conversionId := ctx.Param("conversation_id")
	chatRequest := ChatRequest{}
	err = ctx.ShouldBindJSON(&chatRequest)
	if err != nil {
		elog.Error("should bind json", zap.Error(err))
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 最后一条里的content，作为输入内容
	chatInput, err := handleChatRequest(chatRequest)
	if err != nil {
		elog.Error("handle chat request", zap.Error(err))
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	event := make(chan string)

	// todo，处理这些 id
	userId := "111"

	// chatInput = "你好，你是谁"

	// 对接 openai 协议
	go invoker.ChatService.Chat(ctx.Request.Context(), userId, conversionId, chatInput, event)

	ctx.Stream(func(w io.Writer) bool {
		e, ok := <-event
		if !ok {
			return false
		}
		elog.Info("chat event", zap.String("event", e))
		ctx.Writer.WriteString(e)
		w.(http.Flusher).Flush()

		return true
	})
}

// 处理输入，特别是自定义 key
func handleChatRequest(chatRequest ChatRequest) (chatInput string, err error) {
	if len(chatRequest.Messages) == 0 {
		err = errors.New("no messages")
		return
	}

	if chatRequest.CustomKey != "" {
		chatInput = chatRequest.CustomKey
		return
	}

	// todo 只拿了最后一条，考虑支持更多
	chatInput = chatRequest.Messages[len(chatRequest.Messages)-1].Content
	return
}

// GetConversation 根据文件 id 获取对话 id 及历史，如果没有对话，则新建对话
func GetConversation(ctx *gin.Context) {
	fileId := ctx.Param("fileId")
	if fileId == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "fileId is required"})
		return
	}
	// todo
	userId := "111"

	// 获取或创建对话
	conversation, err := invoker.ChatService.GetOrCreateConversation(ctx.Request.Context(), userId, fileId)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"conversationId": conversation.ConversationId,
		"messages":       conversation.Messages,
	})
}
