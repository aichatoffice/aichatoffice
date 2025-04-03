package aisvc

import (
	"context"
	"fmt"
	"net/http"
	"net/url"

	"github.com/gotomicro/cetus/l"
	"github.com/gotomicro/ego/core/elog"
	"github.com/sashabaranov/go-openai"
	"go.uber.org/zap"

	"aichatoffice/pkg/utils"
)

type OpenAISvc struct {
	client *openai.Client
	OpenAiConfig
}

type OpenAiConfigMode string

const (
	OpenAiConfigModeLocal  OpenAiConfigMode = "local"
	OpenAiConfigModeRemote OpenAiConfigMode = "remote" // todo 支持远程获取配置
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

func NewOpenAI(configSvc *AiConfigSvc) (OpenAISvc, error) {
	ctx := context.Background()
	aiConfigs, err := configSvc.GetAIConfig(ctx)
	if err != nil {
		return OpenAISvc{}, fmt.Errorf("获取AI配置失败: %w", err)
	}

	// 假设我们使用第一个配置
	if len(aiConfigs) == 0 {
		return OpenAISvc{}, nil
	}

	config := aiConfigs[0]
	aiConfig := OpenAiConfig{
		Token:     config.Token,
		TextModel: config.TextModel,
		BaseUrl:   config.BaseUrl,
	}

	elog.Info("final ai config", l.A("aiConfig", aiConfig))

	openAIManager := OpenAISvc{}
	openAIManager.loadConfig(aiConfig)
	return openAIManager, nil
}

func (o *OpenAISvc) loadConfig(aiConfig OpenAiConfig) {
	o.OpenAiConfig = aiConfig

	goopenaiConfig := openai.DefaultConfig(o.OpenAiConfig.Token)
	if o.OpenAiConfig.ProxyUrl != "" {
		proxyURL, _ := url.Parse(o.OpenAiConfig.ProxyUrl)
		goopenaiConfig.HTTPClient = &http.Client{
			Transport: &http.Transport{
				Proxy: http.ProxyURL(proxyURL),
			},
		}
	}
	goopenaiConfig.BaseURL = o.OpenAiConfig.BaseUrl
	o.client = openai.NewClientWithConfig(goopenaiConfig)
}

func (o OpenAISvc) CompletionsStream(chatInput string, event *utils.TeeWriter) {
	streamResp, err := o.client.CreateChatCompletionStream(context.Background(), openai.ChatCompletionRequest{
		Model: o.OpenAiConfig.TextModel,
		Messages: []openai.ChatCompletionMessage{
			{
				Role:    openai.ChatMessageRoleUser,
				Content: chatInput,
			},
		},
	})
	if err != nil {
		elog.Error("create chat completion", zap.Error(err), l.A("chatInput", chatInput))
		return
	}
	defer streamResp.Close()

	for {
		chunk, err := streamResp.Recv()
		if err != nil {
			// todo 错误处理
			elog.Error("recv", zap.Error(err))
			break
		}

		if chunk.Choices[0].FinishReason == "stop" {
			// todo 结束处理
			break
		}

		if chunk.Choices[0].Delta.Content != "" {
			event.Write([]byte(chunk.Choices[0].Delta.Content))
		}
	}
}
