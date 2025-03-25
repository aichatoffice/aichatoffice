package aisvc

import "aichatoffice/pkg/utils"

// todo
type AiSvc interface {
	// Completions(ctx context.Context, req []ChatObj) (*dto.TextResponse, error)
	CompletionsStream(chatInput string, event *utils.TeeWriter)
	// ChatStream(ctx context.Context, uid string, system string, reqMessages []dto.ChatMessage, messageId string, msgEvent chan<- dto.ChatMessage) error
	// Image(ctx context.Context, req *dto.ImageRequest) (*dto.ImageResponse, error)
}
