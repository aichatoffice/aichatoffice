package dto

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
)

// ChatConversation 代表一个聊天会话
type ChatConversation struct {
	ConversationId string        `json:"conversation_id" gorm:"primaryKey"`
	FileGuid       string        `json:"file_guid"`
	UserId         string        `json:"user_id"`
	Messages       []ChatMessage `json:"messages" gorm:"foreignKey:ConversationId;constraint:OnDelete:CASCADE"`
	Created        int64         `json:"created"`
	System         string        `json:"system"`
}

// ChatMessage 代表单条消息
type ChatMessage struct {
	ID             uint         `json:"id" gorm:"primaryKey;autoIncrement"`
	ConversationId string       `json:"conversation_id" gorm:"index"` // 外键
	Role           string       `json:"role"`
	Content        string       `json:"content"`
	Parts          ContentParts `json:"parts" gorm:"type:text"` // JSON 存储
}

// ContentPart 代表消息的内容部分
type ContentPart struct {
	Type     string `json:"type"`                // 内容类型
	Text     string `json:"text,omitempty"`      // 文本内容
	ImageUrl string `json:"image_url,omitempty"` // 图片 URL
}

// ContentParts 是 ContentPart 切片，实现 GORM JSON 存储
type ContentParts []ContentPart

// Value 实现 driver.Valuer 接口，将 ContentParts 转换为 JSON 存入数据库
func (cp ContentParts) Value() (driver.Value, error) {
	bytes, err := json.Marshal(cp)
	if err != nil {
		return nil, err
	}
	return string(bytes), nil
}

// Scan 实现 sql.Scanner 接口，将数据库中的 JSON 转换回 ContentParts
func (cp *ContentParts) Scan(value interface{}) error {
	if value == nil {
		*cp = ContentParts{}
		return nil
	}

	var bytes []byte
	switch v := value.(type) {
	case []byte:
		bytes = v
	case string:
		bytes = []byte(v)
	default:
		return fmt.Errorf("unsupported scan type for ContentParts: %T", value)
	}

	return json.Unmarshal(bytes, cp)
}

// TableName 指定表名
func (c *ChatConversation) TableName() string {
	return "chat_conversations"
}

func (m *ChatMessage) TableName() string {
	return "chat_messages"
}
