package aisvc

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
	"github.com/gotomicro/cetus/l"
	"github.com/gotomicro/ego/core/econf"
	"github.com/gotomicro/ego/core/elog"
	"github.com/samber/lo"
	goopenai "github.com/sashabaranov/go-openai"
	"github.com/spf13/cast"
	"go.uber.org/zap"

	"aichatoffice/pkg/models/dto"
)

type openAI struct {
	client     *goopenai.Client
	aiProvider iAiProvider
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
	return
}

func (o *openAI) Completions(ctx context.Context, req []ChatObj) (*dto.TextResponse, error) {
	msgs := make([]goopenai.ChatCompletionMessage, len(req))
	for i := range req {
		msgs[i] = goopenai.ChatCompletionMessage{
			Role:    req[i].role,
			Content: req[i].content,
		}
	}

	response, err := o.client.CreateChatCompletion(ctx, goopenai.ChatCompletionRequest{
		Model:    o.TextModel,
		Messages: msgs,
	})

	if err != nil {
		elog.Error("req err", zap.Error(err))
		return nil, err
	}
	choice := response.Choices[0]
	return &dto.TextResponse{
		Role:    choice.Message.Role,
		Content: choice.Message.Content,
	}, nil
}

func (o *openAI) CompletionsStream(ctx *gin.Context, req []ChatObj) error {
	msgs := make([]goopenai.ChatCompletionMessage, len(req))
	for i := range req {
		msgs[i] = goopenai.ChatCompletionMessage{
			Role:    req[i].role,
			Content: req[i].content,
		}
	}

	stream, err := o.client.CreateChatCompletionStream(context.Background(), goopenai.ChatCompletionRequest{
		Model:    o.TextModel,
		Messages: msgs,
	})
	if err != nil {
		elog.Error("req err", zap.Error(err))
		return err
	}
	defer stream.Close()
	ctx.Stream(func(w io.Writer) bool {
		response, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			elog.Info("read body end")
			return false
		} else if err != nil {
			elog.Error("read body error", zap.Error(err))
			return false
		}

		res := dto.ChatStreamResponse{
			Id:      response.ID,
			Object:  response.Object,
			Created: response.Created,
			Result:  response.Choices[0].Delta.Content,
		}
		if response.Choices[0].FinishReason == "stop" {
			res.IsEnd = true
		}
		bytes, err := json.Marshal(res)
		if err != nil {
			elog.Info("marshal error", zap.Error(err))
			return false
		}
		w.Write([]byte(fmt.Sprintf("data: %s\n\n", bytes)))
		return true
	})
	ctx.Writer.Flush()

	return nil
}

// 直接用chat gpt 模型读取数据
func (o *openAI) openAiReader(ctx context.Context, req goopenai.ChatCompletionRequest, messageId string, msgEvent chan<- dto.ChatMessage) error {
	stream, err := o.client.CreateChatCompletionStream(ctx, req)
	if err != nil {
		elog.Error("req err", zap.Error(err))
		return err
	}

	go func(stream *goopenai.ChatCompletionStream) {
		defer stream.Close()
		var sentenceId int
		var readStr string
		var readLimit = 30
		for {
			line, err := stream.Recv()
			if errors.Is(err, io.EOF) {
				// 正常结束
				elog.Info("read body end")
				readStr = strings.TrimPrefix(readStr, "data:")
				msgEvent <- dto.ChatMessage{
					MessageId:   messageId,
					Role:        dto.ChatMessageRoleAssistant,
					Type:        dto.ChatMessageTypeAnswer,
					Content:     dto.ChatContents{{Type: dto.ChatContentTypeText, Text: lo.ToPtr(readStr)}},
					IsEnd:       true,
					IsTruncated: true,
					Created:     time.Now().UnixMilli(),
					SentenceId:  sentenceId + 1,
				}
				close(msgEvent)
				break
			}

			if err != nil {
				elog.Error("read body error", zap.Error(err))
				readStr = strings.TrimPrefix(readStr, "data:")
				msgEvent <- dto.ChatMessage{
					MessageId: messageId,
					Role:      dto.ChatMessageRoleAssistant,
					Type:      dto.ChatMessageTypeError,
					ErrorCode: 500,
					ErrorMsg:  err.Error(),
				}
				close(msgEvent)
				break
			}

			content := line.Choices[0].Delta.Content
			readStr += content
			if utf8.RuneCountInString(readStr) < readLimit {
				continue
			}
			readStr = strings.TrimPrefix(readStr, "data:")
			msgEvent <- dto.ChatMessage{
				MessageId:   messageId,
				Role:        dto.ChatMessageRoleAssistant,
				Type:        dto.ChatMessageTypeAnswer,
				SentenceId:  sentenceId,
				Content:     dto.ChatContents{{Text: lo.ToPtr(readStr), Type: dto.ChatContentTypeText}},
				IsEnd:       false,
				IsTruncated: false,
				Created:     time.Now().UnixMilli(),
			}
			readStr = ""
			sentenceId++
		}
	}(stream)

	return nil
}

func (o *openAI) getToken(uid int64) string {
	token := o.Token
	if token == "" {
		token = cast.ToString(uid)
	}
	return token
}

func (o *openAI) ChatStream(ctx context.Context, uid string, system string, reqMessages []dto.ChatMessage, messageId string, msgEvent chan<- dto.ChatMessage) error {
	chatReq := dto.ChatReq{
		Messages: make([]dto.ChatMsg, 0, len(reqMessages)),
		Stream:   true,
		System:   system,
	}
	var inputLength int
	var totalTokens int
	// 倒序
	for i := len(reqMessages) - 1; i >= 0; i-- {
		if reqMessages[i].Role != dto.ChatMessageRoleUser && reqMessages[i].Role != dto.ChatMessageRoleAssistant {
			continue
		}
		inputLength += len(reqMessages[i].Text)
		if reqMessages[i].Role == dto.ChatMessageRoleAssistant && reqMessages[i].Usage != nil {
			totalTokens += reqMessages[i].Usage.CompletionTokens
		}
		if reqMessages[i].Role == dto.ChatMessageRoleUser && reqMessages[i].Usage != nil {
			totalTokens += reqMessages[i].Usage.PromptTokens
		}
		if o.InputMaxToken > 0 {
			if i == len(reqMessages)-1 {
				// tricky: 如果当前请求已经超过了 token 限制，那就截取前后各一半的数据
				chatReq.Messages = append(chatReq.Messages, dto.ChatMsg{
					Role:    string(reqMessages[i].Role),
					Content: o.truncateString(reqMessages[i].Text),
				})
			}
			break
		}
		chatReq.Messages = append(chatReq.Messages, dto.ChatMsg{
			Role:    string(reqMessages[i].Role),
			Content: reqMessages[i].Text,
		})
	}
	// 逆序排列
	lo.Reverse(chatReq.Messages)
	if chatReq.Messages[0].Role != string(dto.ChatMessageRoleUser) {
		if len(chatReq.Messages) < 2 {
			return dto.ErrAiChat
		}
		// 第一条消息不是 assistant 的话，需要将这条消息去掉
		chatReq.Messages = chatReq.Messages[1:]
	}

	msgs := make([]goopenai.ChatCompletionMessage, 0)
	// 增加系统角色
	msgs = append(msgs, goopenai.ChatCompletionMessage{
		Role:    string(dto.ChatMessageRoleSystem),
		Content: system,
	})

	for i := range chatReq.Messages {
		msgs = append(msgs, goopenai.ChatCompletionMessage{
			Role:    chatReq.Messages[i].Role,
			Content: chatReq.Messages[i].Content,
		})
	}

	var req = goopenai.ChatCompletionRequest{
		Model:     o.TextModel,
		Messages:  msgs,
		Stream:    true,
		MaxTokens: o.OutputMaxToken,
	}
	// if o.isOpenAi() {
	return o.openAiReader(ctx, req, messageId, msgEvent)
	// } else {
	// 	return o.otherModelReader(ctx, uid, req, messageId, msgEvent)
	// }
}

func (o *openAI) Image(ctx context.Context, req *dto.ImageRequest) (*dto.ImageResponse, error) {
	response, err := o.client.CreateImage(ctx, goopenai.ImageRequest{
		Prompt:         req.Prompt,
		N:              1,
		Size:           "256x256",
		ResponseFormat: "b64_json",
	})
	if err != nil {
		// ctx.AbortWithStatusJSON(500, gin.H{"msg": err.Error(), "code": 500})
		elog.Error("openai image error", zap.Error(err))
		return nil, err
	}
	inner := response.Data[0]

	return &dto.ImageResponse{Data: inner.B64JSON}, nil
}

func (o *openAI) SupportContext(ctx context.Context) bool {
	return econf.GetBool("chatgpt.supportContext")
}

func (o *openAI) Tokenizer(ctx context.Context, prompt string) (int, error) {
	// TODO implement me
	panic("implement me")
}

func (o *openAI) name() string {
	return o.Name
}

func (o *openAI) isOpenAi() bool {
	return false
}

func (o *openAI) truncateString(input string) string {
	runes := []rune(input)
	length := len(runes)
	if length <= o.InputMaxToken {
		return input
	}
	half := o.InputMaxToken / 2
	return string(runes[:half]) + "..." + string(runes[length-half:])
}
