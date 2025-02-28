package middlewares

import (
	"github.com/gin-gonic/gin"
)

const (
	chatUserGuid = "turbo_hxg_uid"
)

func ChatUser() gin.HandlerFunc {
	return func(c *gin.Context) {

		c.Next()
	}
}

func GetChatUserGuid(c *gin.Context) string {
	// uid, ok := c.Get(chatUserGuid)
	// if !ok {
	// 	elog.Error("chat user guid not found")
	// 	return ""
	// }
	// return uid.(string)
	return "demo_user"
}
