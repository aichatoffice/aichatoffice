package middlewares

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		preflight := c.Request.Method == "OPTIONS"
		origin := c.Request.Header.Get("origin")

		if origin == "" {
			if !preflight {
				c.Next()
				return
			}
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", c.Request.Header.Get("Access-Control-Request-Headers"))
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if preflight {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Writer.Header().Set("Access-Control-Expose-Headers", "Content-Disposition, X-File-Name")

		c.Next()
	}
}
