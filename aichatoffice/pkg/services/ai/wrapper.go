package aisvc

import (
	"context"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gotomicro/cetus/l"
	"github.com/gotomicro/ego/core/econf"
	"github.com/gotomicro/ego/core/elog"
	cmap "github.com/orcaman/concurrent-map/v2"
	"go.uber.org/zap"

	"aichatoffice/pkg/models/dto"
)

var UserIdKey = "userId"

type cacheItem struct {
	lastTime int64     // unix ms 最后一次请求时间
	msg      []ChatObj // 上下文记录
}

type AiWrapper struct {
	aiProvider iAiProvider
	// 对话上下文
	contextCache cmap.ConcurrentMap[string, *cacheItem]
	// 对话配置
	userChatConfig *userChatConfig
	resetWords     map[string]struct{}
}

type userChatConfig struct {
	Reset   []string `toml:"reset"`
	Timeout int64    `toml:"timeout"`
}

func NewAiWrapper() *AiWrapper {
	ai, err := NewOpenAI()
	if err != nil {
		elog.Error("new ai wrapper fail", l.E(err))
		return nil
	}

	userChatConfig := userChatConfig{}
	err = econf.UnmarshalKey("userChat", &userChatConfig)
	if err != nil {
		elog.Error("new ai wrapper fail", l.E(err))
		return nil
	}

	resetWords := make(map[string]struct{}, len(userChatConfig.Reset))
	for i := range userChatConfig.Reset {
		resetWords[userChatConfig.Reset[i]] = struct{}{}
	}

	return &AiWrapper{
		aiProvider:     ai,
		contextCache:   cmap.New[*cacheItem](),
		userChatConfig: &userChatConfig,
		resetWords:     make(map[string]struct{}),
	}
}

func (w *AiWrapper) Image(ctx context.Context, req *dto.ImageRequest) (*dto.ImageResponse, error) {
	return w.aiProvider.Image(ctx, req)
}

func (w *AiWrapper) Tokenizer(ctx context.Context, prompt string) (int, error) {
	// 接口有权限问题，先直接粗略计算
	return len([]rune(prompt)), nil
	// return w.aiProvider.Tokenizer(ctx, prompt)
}

func (w *AiWrapper) ChatStream(ctx context.Context, uid string, system string, reqMessages []dto.ChatMessage, messageId string, msgEvent chan<- dto.ChatMessage) error {
	return w.aiProvider.ChatStream(ctx, uid, system, reqMessages, messageId, msgEvent)
}

func (w *AiWrapper) Completions(ctx context.Context, req *dto.TextRequest) (*dto.TextResponse, error) {
	if !w.aiProvider.SupportContext(ctx) {
		// 不支持上下文 透传
		return w.aiProvider.Completions(ctx, []ChatObj{{
			role:    "user",
			content: req.Prompt,
		}})
	}

	userId := ctx.Value(UserIdKey).(string)
	item, ok := w.contextCache.Get(userId)
	if ok {
		if time.Now().UnixMilli()-item.lastTime > w.userChatConfig.Timeout {
			// 超时 重新开始会话
			w.contextCache.Remove(userId)
			item = &cacheItem{
				msg: make([]ChatObj, 0),
			}
		} else if _, ok := w.resetWords[req.Prompt]; ok {
			// 触发清除上下文关键词
			w.contextCache.Remove(userId)
			// ctx.AbortWithStatusJSON(200, gin.H{"code": 200, "msg": "", "data": req.Prompt})
			return &dto.TextResponse{Content: ""}, nil
		}
	} else {
		item = &cacheItem{
			msg: []ChatObj{},
		}
	}
	item.msg = append(item.msg, ChatObj{
		role:    "user",
		content: req.Prompt,
	})
	response, err := w.aiProvider.Completions(ctx, item.msg)

	if err != nil {
		return response, err
	}
	item.msg = append(item.msg, ChatObj{
		role:    response.Role,
		content: response.Content,
	})
	item.lastTime = time.Now().UnixMilli()
	w.contextCache.Set(userId, item)
	elog.Info("chat info", zap.String("userId", userId), zap.Any("msg", item.msg))
	return response, nil
}

func (w *AiWrapper) CompletionsStream(ctx *gin.Context, req *dto.TextRequest) error {
	return w.aiProvider.CompletionsStream(ctx, []ChatObj{{
		role:    "user",
		content: req.Prompt,
	}})
}
