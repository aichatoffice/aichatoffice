package chatsvc

import (
	"context"
	"time"

	"aichatoffice/pkg/models/dto"
	"aichatoffice/pkg/models/leveldb"
)

// ai-chat 相关
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
}

func NewChatStore(l leveldb.LevelDB) (ChatStore, error) {
	var (
		client ChatStore
	)

	client = l

	// 删除过期 key
	go func() {
		for {
			time.Sleep(time.Second * 5)
			client.DeleteExpireKeys()
		}
	}()
	return client, nil
}
