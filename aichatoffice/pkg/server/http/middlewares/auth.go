package middlewares

import (
	"net/http"
	"strings"

	"aichatoffice/pkg/utils"

	"github.com/dgrijalva/jwt-go"
	"github.com/gin-gonic/gin"
	"github.com/gotomicro/ego/core/econf"
)

func Auth() gin.HandlerFunc {
	return func(c *gin.Context) {
		fullPath := c.FullPath()
		if !strings.HasPrefix(fullPath, "/v1/thirdparty") {
			c.Next()
			return
		}
		token := c.GetHeader("X-OfficeSdk-Token")
		if token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"message": "token is required",
			})
			return
		}
		err := ValidateToken(c, token)
		if err != nil {
			return
		}

		c.Next()
	}
}

// ValidateToken 验证token
func ValidateToken(c *gin.Context, token string) error {
	decodedToken, err := jwt.ParseWithClaims(token, &utils.UserClaims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(econf.GetString("jwt.secret")), nil
	})

	if decodedToken == nil || !decodedToken.Valid {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
			"message": "invalid token",
		})
		return err
	}

	claim, ok := decodedToken.Claims.(*utils.UserClaims)
	if !ok {
		panic("parse token error")
	}
	c.Set("userId", claim.UserId)

	return err
}
