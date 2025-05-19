package utils

import (
	"strings"
	"time"

	"github.com/dgrijalva/jwt-go"
	"github.com/google/uuid"
	"github.com/gotomicro/ego/core/econf"
)

// GenFileGuid 生成 16 位的 file-guid
func GenFileGuid() string {
	return strings.Replace(uuid.New().String(), "-", "", -1)[:16]
}

type UserClaims struct {
	*jwt.StandardClaims
	UserId int64 `json:"userId"`
}

// SignJWT 签发Token
func SignJWT(userId int64, expr time.Duration) string {
	if expr == 0 {
		expr = 24 * time.Hour
	}
	secret := econf.GetString("jwt.secret")
	token := jwt.NewWithClaims(
		jwt.SigningMethodHS256, &UserClaims{
			StandardClaims: &jwt.StandardClaims{
				ExpiresAt: time.Now().Add(expr).Unix(),
			},
			UserId: userId,
		})
	tokenStr, err := token.SignedString([]byte(secret))
	if err != nil {
		panic(err)
	}
	return tokenStr
}
