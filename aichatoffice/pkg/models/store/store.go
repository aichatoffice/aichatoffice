package store

import (
	"context"
	"time"

	"aichatoffice/pkg/models/dto"
)

// Package store defines the abstraction of data storage and retrieval

// FileStore defines the abstraction of file storage and retrieval
type FileStore interface {
	GetFile(ctx context.Context, fileID string) (file dto.File, err error)
	SetFile(ctx context.Context, f dto.File) error
	DeleteFile(ctx context.Context, fileID string) error
	GetFilesList(ctx context.Context) (files []dto.File, err error)
}

// ChatStore defines the abstraction of chat storage and retrieval
type ChatStore interface {
	NewConversation(ctx context.Context, userId string, conversationId string, fileGuid string) error
	CountConversation(ctx context.Context, userId string) (int, error)
	GetFileConversation(ctx context.Context, userId string, fileGuid string) (*dto.ChatConversation, error)
	GetConversation(ctx context.Context, userId string, conversationId string) (*dto.ChatConversation, error)
	GetMessages(ctx context.Context, conversationId string) ([]dto.ChatMessage, error)
	AddMessages(ctx context.Context, conversationId string, messages []dto.ChatMessage) error
	// TODO
	BreakConversation(ctx context.Context, userId string, conversationId string) error
	IsConversationBreak(ctx context.Context, userId string, conversationId string) (bool, error)
	ResumeConversation(ctx context.Context, userId string, conversationId string) error
	DeleteConversation(ctx context.Context, userId string, conversationId string) error
	DeleteExpireKeys() error
	RunDeleteExpireKeysCronjob(interval time.Duration)
}
