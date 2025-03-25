package middlewares

import (
	"github.com/gin-gonic/gin"
)

const (
	CtxUserGuid = "ctx_uid"
)

func ChatUser() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set(CtxUserGuid, getChatUserGuid(c))
		c.Next()
	}
}

func getChatUserGuid(c *gin.Context) string {
	//todo
	return "demo_user"
}
