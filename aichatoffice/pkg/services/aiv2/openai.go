package aiv2svc

import (
	"fmt"
	"io"
	"math/rand"
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
	ctx.Header("Content-Type", "text/event-stream; charset=utf-8")
	ctx.Stream(func(w io.Writer) bool {
		ticker := time.NewTicker(500 * time.Millisecond)
		defer ticker.Stop()
		timeout := time.After(3 * time.Second)

		for {
			select {
			case <-timeout:
				return false
			case <-ticker.C:
				randomNumber := rand.Intn(100) // 生成随机数字
				_, err := fmt.Fprintf(w, "data: %d\n\n", randomNumber)
				if err != nil {
					elog.Error("write error", zap.Error(err))
					return false
				}
				w.(http.Flusher).Flush()
			}
		}
	})
}
