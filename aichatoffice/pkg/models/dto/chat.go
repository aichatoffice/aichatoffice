package dto

// todo 优化顺序和排版
type ChatMessageRole string

const (
	ChatMessageRoleUser      ChatMessageRole = "user"
	ChatMessageRoleAssistant ChatMessageRole = "assistant"
	ChatMessageRoleSystem    ChatMessageRole = "system"
)

type ChatMessageType string

const (
	ChatMessageTypeAnswer   ChatMessageType = "answer"
	ChatMessageTypeQuestion ChatMessageType = "question"
	ChatMessageTypeSystem   ChatMessageType = "system"
	ChatMessageTypeError    ChatMessageType = "error"
)

type ChatContentType string

const (
	ChatContentTypeText          ChatContentType = "text"
	ChatContentTypeTextProcessor ChatContentType = "text_processor"
	// ChatContentTypeFile          ChatContentType = "file"
	ChatContentTypeImage ChatContentType = "image"
)

type TokenResp struct {
	RefreshToken  string `json:"refresh_token"`
	ExpiresIn     int    `json:"expires_in"`
	SessionKey    string `json:"session_key"`
	AccessToken   string `json:"access_token"`
	Scope         string `json:"scope"`
	SessionSecret string `json:"session_secret"`
}

type ChatReq struct {
	Messages []ChatMsg `json:"messages"`
	User     string    `json:"user"`
	Stream   bool      `json:"stream"`
	System   string    `json:"system"`
}

type ChatMsg struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatResp struct {
	Id          string `json:"id"`
	Object      string `json:"object"`
	Created     int    `json:"created"`
	SentenceId  int    `json:"sentence_id"`
	IsEnd       bool   `json:"is_end"`
	IsTruncated bool   `json:"is_truncated"`
	Result      string `json:"result"`
	Usage       struct {
		PromptTokens     int `json:"prompt_tokens"`     // 问题tokens数
		CompletionTokens int `json:"completion_tokens"` // 回答tokens数
		TotalTokens      int `json:"total_tokens"`      // tokens总数
	} `json:"usage"`
	ErrorCode int    `json:"error_code,omitempty"`
	ErrorMsg  string `json:"error_msg,omitempty"`
}

// 前端传参，表示本次 chat 的行为
type ChatContent struct {
	Type ChatContentType `json:"type,omitempty"`

	Text          *string               `json:"text,omitempty"`           // prompt
	TextProcessor *ContentTextProcessor `json:"text_processor,omitempty"` // TODO约定入参
	TextContext   *string               `json:"text_context,omitempty"`   // 和前端约定的 prompt 模板
}

type ChatRequest struct {
	Stream         bool         `json:"stream"`
	Content        ChatContents `json:"content"`
	RegenMessageId string       `json:"regen_message_id"`
}

type ChatContents []ChatContent

type ChatMessage struct {
	MessageId   string                 `json:"message_id,omitempty"`
	Role        ChatMessageRole        `json:"role,omitempty"`
	Type        ChatMessageType        `json:"type,omitempty"`
	SentenceId  int                    `json:"sentence_id"`
	IsEnd       bool                   `json:"is_end,omitempty"`
	IsTruncated bool                   `json:"is_truncated,omitempty"`
	Content     ChatContents           `json:"content,omitempty"`
	Text        string                 `json:"text,omitempty"`
	Created     int64                  `json:"created,omitempty"` // 目前用来给消息排序
	ErrorCode   int                    `json:"error_code,omitempty"`
	ErrorMsg    string                 `json:"error_msg,omitempty"`
	Usage       *ChatMessageTokenUsage `json:"usage,omitempty"`
}

type ChatMessageTokenUsage struct {
	PromptTokens     int `json:"prompt_tokens,omitempty"`     // 问题tokens数
	CompletionTokens int `json:"completion_tokens,omitempty"` // 回答tokens数
	TotalTokens      int `json:"total_tokens,omitempty"`      // tokens总数 prompt_tokens + completion_tokens
}
type ChatMessageDO struct {
	ChatMessage
	NeedAIChat bool `json:"need_ai_chat"`
}

type ChatConversation struct {
	ConversationId string          `json:"conversation_id"`
	System         string          `json:"system"`
	FileGuid       string          `json:"file_guid"`
	UserId         string          `json:"user_id"`
	Messages       []ChatMessageDO `json:"messages"`
}

type TextResponse struct {
	Role    string `json:"-"`
	Content string `json:"data"`
}

type ImageRequest struct {
	Prompt string `json:"prompt"`
}

type ImageResponse struct {
	Data string
}

type ChatStreamResponse struct {
	Id               string `json:"id"`
	Object           string `json:"object"`
	Created          int64  `json:"created"`
	SentenceId       int    `json:"sentence_id"`
	IsEnd            bool   `json:"is_end"`
	Result           string `json:"result"`
	NeedClearHistory bool   `json:"need_clear_history"`
	Usage            struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
	} `json:"usage"`
}

type SummarizeRequest struct {
	FileId string `json:"file_id"`
}

type ContentTextProcessor struct {
	Text   string                 `json:"text,omitempty"`
	Action string                 `json:"action,omitempty"`
	Guid   string                 `json:"guid,omitempty"`
	Ext    map[string]interface{} `json:"ext,omitempty"`
}

type NewConversationRequest struct {
	System   string `json:"system"`
	FileGuid string `json:"guid"`
}

type TextRequest struct {
	Prompt string `json:"prompt"`
	Stream bool   `json:"stream"`
}
