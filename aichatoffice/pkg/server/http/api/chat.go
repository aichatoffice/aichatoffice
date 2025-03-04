package api

import (
	"errors"
	"net/http"
	"runtime"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gotomicro/ego/core/elog"
	jsoniter "github.com/json-iterator/go"
	"github.com/spf13/cast"
	"go.uber.org/zap"

	"aichatoffice/pkg/invoker"
	"aichatoffice/pkg/models/dto"
	"aichatoffice/pkg/server/http/middlewares"
	"aichatoffice/pkg/utils"
)

func NewConversation(c *gin.Context) {
	userId, ok := getUserId(c)
	if !ok || userId == "" {
		elog.Error("no userid")
		c.AbortWithStatus(400)
		return
	}
	req := dto.NewConversationRequest{}
	err := c.ShouldBind(&req)
	if err != nil {
		c.AbortWithStatus(400)
		return
	}

	cid, err := invoker.ChatService.NewConversation(c.Request.Context(), userId, req.System, req.FileGuid)
	if err != nil {
		if errors.Is(err, dto.ErrConversationLimitReached) {
			c.AbortWithStatusJSON(400, gin.H{"msg": err.Error(), "code": 400})
			return
		}
		elog.Error("new conversation failed", zap.Error(err), zap.String("userId", cast.ToString(userId)), elog.FieldCtxTid(c.Request.Context()))
		c.AbortWithStatusJSON(500, gin.H{"msg": err.Error(), "code": 500})
		return
	}
	c.JSON(200, gin.H{"data": gin.H{"conversation_id": cid}})
}

func GetConversation(c *gin.Context) {
	userId, ok := getUserId(c)
	if !ok || userId == "" {
		elog.Error("no userid")
		c.AbortWithStatus(400)
		return
	}
	conversationId := c.Param("conversation_id")
	if conversationId == "" {
		elog.Error("no conversation id")
		c.AbortWithStatus(400)
		return
	}
	conversation, err := invoker.ChatService.GetConversation(c.Request.Context(), userId, conversationId)
	if err != nil {
		elog.Error("get conversation failed", zap.Error(err), zap.String("userId", cast.ToString(userId)), zap.String("conversationId", conversationId), elog.FieldCtxTid(c.Request.Context()))
		c.AbortWithStatusJSON(500, gin.H{"msg": err.Error(), "code": 500})
		return
	}
	c.JSON(200, gin.H{"data": conversation})
}

func DeleteConversation(c *gin.Context) {
	userId, ok := getUserId(c)
	if !ok || userId == "" {
		elog.Error("no userid")
		c.AbortWithStatus(400)
		return
	}

	conversationId := c.Param("conversation_id")
	if conversationId == "" {
		elog.Error("no conversation id")
		c.AbortWithStatus(400)
		return
	}

	err := invoker.ChatService.DeleteConversation(c.Request.Context(), userId, conversationId)
	if err != nil {
		elog.Error("delete conversation failed", zap.Error(err), zap.String("userId", cast.ToString(userId)), zap.String("conversationId", conversationId), elog.FieldCtxTid(c.Request.Context()))
		c.AbortWithStatusJSON(500, gin.H{"msg": err.Error(), "code": 500})
		return
	}
	c.Status(http.StatusNoContent)
}

func BreakConversation(c *gin.Context) {
	userId, ok := getUserId(c)
	if !ok || userId == "" {
		elog.Error("no userid")
		c.AbortWithStatus(400)
		return
	}
	conversationId := c.Param("conversation_id")
	err := invoker.ChatService.BreakConversation(c.Request.Context(), userId, conversationId)
	if err != nil {
		elog.Error("break conversation failed", zap.Error(err), zap.String("userId", cast.ToString(userId)), zap.String("conversationId", conversationId), elog.FieldCtxTid(c.Request.Context()))
		c.AbortWithStatusJSON(500, gin.H{"msg": err.Error(), "code": 500})
		return
	}
	c.Status(http.StatusNoContent)
}

func Chat(c *gin.Context) {
	req := dto.ChatRequest{}
	err := c.ShouldBind(&req)
	if err != nil {
		c.AbortWithStatus(400)
		return
	}
	userId, ok := getUserId(c)
	if !ok || userId == "" {
		elog.Error("no userid")
		c.AbortWithStatus(400)
		return
	}
	conversationId := c.Param("conversation_id")
	if conversationId == "" {
		elog.Error("no conversation id")
		c.AbortWithStatus(400)
		return
	}
	var msg dto.ChatMessage
	msg.Content = req.Content
	msg.Role = dto.ChatMessageRoleUser
	msg.MessageId, _ = utils.NewGuid(16)
	msg.Type = dto.ChatMessageTypeQuestion
	msg.Created = time.Now().UnixMilli()
	event := make(chan string)
	c.Writer.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("Transfer-Encoding", "chunked")
	go func() {
		defer func() {
			if r := recover(); r != nil {
				// 获取调用栈信息
				buf := make([]byte, 1024)
				n := runtime.Stack(buf, false)
				stackTrace := buf[:n]
				elog.Error("chat error Recovered", zap.ByteString("error", stackTrace), zap.Any("req", req))
			}
		}()

		for e := range event {
			if c.Writer == nil {
				elog.Error("chat Error: c.Writer is nil")
				return
			}
			_, err := c.Writer.WriteString("data: ")
			if err != nil {
				elog.Error("chat Error writing to response:", zap.Error(err))
				return
			}
			_, err = c.Writer.WriteString(e)
			if err != nil {
				elog.Error("chat Error writing to response:", zap.Error(err))
				return
			}
			_, err = c.Writer.WriteString("\n\n")
			if err != nil {
				elog.Error("chat Error writing to response:", zap.Error(err))
				return
			}
			if flusher, ok := c.Writer.(http.Flusher); ok {
				flusher.Flush()
			} else {
				elog.Error("chat Error: c.Writer does not implement http.Flusher")
				return
			}
		}
		c.Status(http.StatusOK)
	}()
	err = invoker.ChatService.Chat(c.Request.Context(), userId, conversationId, msg, req.RegenMessageId, event)
	if err != nil {
		elog.Error("chat failed", zap.Error(err), zap.String("userId", cast.ToString(userId)), zap.String("conversationId", conversationId), elog.FieldCtxTid(c.Request.Context()))
		apiErr := dto.FromError(err)
		emsg := dto.ChatMessage{
			Role:      dto.ChatMessageRoleAssistant,
			Type:      dto.ChatMessageTypeError,
			ErrorCode: apiErr.Code,
			ErrorMsg:  apiErr.Message,
		}
		msgStr, _ := jsoniter.MarshalToString(emsg)
		c.Writer.WriteString("data: ")
		c.Writer.WriteString(msgStr)
		c.Writer.WriteString("\n\n")
		close(event)
		return
	}
	close(event)
}

func getUserId(c *gin.Context) (string, bool) {
	uid := middlewares.GetChatUserGuid(c)
	if uid == "" {
		return "", false
	}
	return uid, true
}
