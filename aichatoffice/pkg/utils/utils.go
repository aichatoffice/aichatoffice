package utils

import (
	"strings"

	"github.com/google/uuid"
)

// GenFileGuid 生成 16 位的 file-guid
func GenFileGuid() string {
	return strings.Replace(uuid.New().String(), "-", "", -1)[:16]
}
