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
	SetFile(ctx context.Context, fileID string, f dto.File) error
	DeleteFile(ctx context.Context, fileID string) error
	GetFilesList(ctx context.Context) (files []dto.File, err error)
}

// ChatStore defines the abstraction of chat storage and retrieval
type ChatStore interface {
	NewConversation(ctx context.Context, userId string, conversationId string, system string, fileGuid string) error
	GetConversation(ctx context.Context, userId string, conversationId string) (*dto.ChatConversation, error)
	AddMessage(ctx context.Context, userId string, conversationId string, msg dto.ChatMessageDO) error
	BreakConversation(ctx context.Context, userId string, conversationId string) error
	IsConversationBreak(ctx context.Context, userId string, conversationId string) (bool, error)
	ResumeConversation(ctx context.Context, userId string, conversationId string) error
	CountConversation(ctx context.Context, userId string) (int, error)
	DeleteConversation(ctx context.Context, userId string, conversationId string) error
	DeleteExpireKeys() error
	RunDeleteExpireKeysCronjob(interval time.Duration)
}
