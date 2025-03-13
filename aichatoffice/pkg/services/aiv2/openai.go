package aiv2svc

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gotomicro/cetus/l"
	"github.com/gotomicro/ego/core/econf"
	"github.com/gotomicro/ego/core/elog"
	goopenai "github.com/sashabaranov/go-openai"
	"go.uber.org/zap"
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

func Completions(ctx *gin.Context) {
	ctx.Writer.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
	ctx.Writer.Header().Set("Cache-Control", "no-cache")
	ctx.Writer.Header().Set("Connection", "keep-alive")
	ctx.Writer.Header().Set("Transfer-Encoding", "chunked")
	ctx.Writer.Header().Set("x-vercel-ai-data-stream", "v1")

	event := make(chan string)

	go func() {
		event <- "hehellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellohellollo"
		time.Sleep(time.Second)
		event <- "world"
		time.Sleep(time.Second)
		event <- "world"
		time.Sleep(time.Second)
		event <- "world"
		time.Sleep(time.Second)
		event <- "world"
		time.Sleep(time.Second)
		event <- "world"
		time.Sleep(time.Second)
		event <- "world"
		time.Sleep(time.Second)
		event <- "world"
		time.Sleep(time.Second)
		event <- "world"
		time.Sleep(time.Second)
		event <- "world"
		close(event)
	}()

	ctx.Stream(func(w io.Writer) bool {
		e, ok := <-event
		if !ok {
			return false
		}
		elog.Info("chat event", zap.String("event", e))
		// ctx.Writer.WriteString(fmt.Sprintf("0: %s\n", e))
		ctx.Writer.WriteString(fmt.Sprintf("data: %s\n\n", e))
		w.(http.Flusher).Flush()

		return true
	})
}
