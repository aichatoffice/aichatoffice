package utils

import (
	"crypto/rand"
	"encoding/base64"
	"math"
	"math/big"
	"regexp"
)

var (
	chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
	cLen  = big.NewInt(62)
)

var specialCharsRegexp = regexp.MustCompile(`[/+=]`)
var guidRegexp = regexp.MustCompile(`^[A-Za-z0-9]+$`)

func NewGuid(length int) (string, error) {
	if length == 0 {
		length = 16
	}

	ret := make([]uint8, 0, length)

	if length <= 4 {
		for i := 0; i < length; i++ {
			c, err := randomChar()

			if err != nil {
				return "", err
			}

			ret = append(ret, c)
		}

		return string(ret), nil
	}

	ranLen := math.Float32frombits(uint32(length) / 2)

	b := make([]byte, uint32(ranLen))
	_, err := rand.Read(b)

	if err != nil {
		return "", err
	}

	encoded, err := base64.StdEncoding.DecodeString(string(b))

	if err != nil {
		return "", err
	}

	encodedStr := string(encoded)

	for specialCharsRegexp.MatchString(encodedStr) {
		var replaceErr error
		encodedStr = specialCharsRegexp.ReplaceAllStringFunc(encodedStr, func(old string) string {
			char, err := randomChar()

			if err != nil {
				replaceErr = err
				return old
			}

			return string(char)
		})

		if replaceErr != nil {
			return "", replaceErr
		}
	}

	retLen := length - len(ret)
	for j := 0; j < retLen; j++ {
		c, err := randomChar()

		if err != nil {
			return "", err
		}

		encodedStr = encodedStr + string(c)
	}

	return encodedStr, nil
}

// IsGUID check if guid string a valid guid
func IsGUID(guid string) bool {
	return guidRegexp.MatchString(guid)
}

func randomChar() (uint8, error) {
	idx, err := rand.Int(rand.Reader, cLen)

	if err != nil {
		return 0, err
	}

	return chars[idx.Uint64()], nil
}
