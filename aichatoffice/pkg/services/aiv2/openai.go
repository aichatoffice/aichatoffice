package aiv2svc

import (
	"io"
	"net/http"
	"net/url"

	"github.com/gin-gonic/gin"
	"github.com/gotomicro/cetus/l"
	"github.com/gotomicro/ego/core/econf"
	"github.com/gotomicro/ego/core/elog"
	goopenai "github.com/sashabaranov/go-openai"
	"go.uber.org/zap"

	"aichatoffice/pkg/models/streaming"
)

type openAI struct {
	client *goopenai.Client
	OpenAiConfig
}

type OpenAiConfigMode string

const (
	OpenAiConfigModeLocal  OpenAiConfigMode = "local"
	OpenAiConfigModeRemote OpenAiConfigMode = "remote"
)

type OpenAiConfig struct {
	ConfigMode     OpenAiConfigMode
	BaseUrl        string
	TextModel      string
	Token          string
	Name           string
	ProxyUrl       string
	Subservice     string
	InputMaxToken  int
	OutputMaxToken int
}

const (
	openAiConfKey = "openai"
)

func NewOpenAI() (*openAI, error) {
	aiConfig := OpenAiConfig{}
	err := econf.UnmarshalKey(openAiConfKey, &aiConfig)
	if err != nil {
		panic(err)
	}

	elog.Info("final ai config", l.A("aiConfig", aiConfig))

	openAIManager := &openAI{}
	openAIManager.loadConfig(aiConfig)
	return openAIManager, nil
}

func (o *openAI) loadConfig(aiConfig OpenAiConfig) {
	o.OpenAiConfig = aiConfig

	goopenaiConfig := goopenai.DefaultConfig(o.OpenAiConfig.Token)
	// 代理地址
	if o.OpenAiConfig.ProxyUrl != "" {
		proxyURL, _ := url.Parse(o.OpenAiConfig.ProxyUrl)
		goopenaiConfig.HTTPClient = &http.Client{
			Transport: &http.Transport{
				Proxy: http.ProxyURL(proxyURL),
			},
		}
	}
	goopenaiConfig.BaseURL = o.OpenAiConfig.BaseUrl

	o.client = goopenai.NewClientWithConfig(goopenaiConfig)
}

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
	ID       string        `json:"id"`       // 会话或请求的唯一标识
	Messages []ChatMessage `json:"messages"` // 消息数组
	// 可选的其他字段
	Model       string  `json:"model,omitempty"`
	Temperature float32 `json:"temperature,omitempty"`
	MaxTokens   int     `json:"max_tokens,omitempty"`
	Stream      bool    `json:"stream,omitempty"`
}

func Completions(ctx *gin.Context) {
	ctx.Writer.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
	ctx.Writer.Header().Set("Cache-Control", "no-cache")
	ctx.Writer.Header().Set("Connection", "keep-alive")
	ctx.Writer.Header().Set("Transfer-Encoding", "chunked")
	ctx.Writer.Header().Set("x-vercel-ai-data-stream", "v1")

	chatRequest := ChatRequest{}
	err := ctx.ShouldBindJSON(&chatRequest)
	if err != nil {
		elog.Error("should bind json", zap.Error(err))
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 最后一条里的content，作为输入内容
	content := chatRequest.Messages[len(chatRequest.Messages)-1].Content
	dataType := streaming.GetTypeByText(content)

	event := make(chan string)

	streaming.GenTestStreamData(dataType, event)

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
