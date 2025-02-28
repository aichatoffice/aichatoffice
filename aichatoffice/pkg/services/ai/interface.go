package aisvc

import (
	"aichatoffice/pkg/models/dto"
	"context"

	"github.com/gin-gonic/gin"
)

type AiProvider struct {
}

type ChatObj struct {
	role    string
	content string
}

type iAiProvider interface {
	// Completions 对话
	Completions(ctx context.Context, req []ChatObj) (*dto.TextResponse, error)
	CompletionsStream(ctx *gin.Context, req []ChatObj) error
	ChatStream(ctx context.Context, uid string, system string, reqMessages []dto.ChatMessage, messageId string, msgEvent chan<- dto.ChatMessage) error
	Image(ctx context.Context, req *dto.ImageRequest) (*dto.ImageResponse, error)
	// SupportContext 是否支持对话上下文
	SupportContext(ctx context.Context) bool
	Tokenizer(ctx context.Context, prompt string) (int, error)
	name() string
}
