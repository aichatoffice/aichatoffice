package dto

type ChatConversation struct {
	ConversationId string `json:"conversation_id"`
	FileGuid       string `json:"file_guid"`
	UserId         string `json:"user_id"`
}

func (c *ChatConversation) TableName() string {
	return "chat_conversations"
}
