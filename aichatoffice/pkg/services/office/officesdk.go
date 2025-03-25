package officesvc

import (
	"io"
	"net/http"

	"github.com/gotomicro/ego/core/elog"
	"go.uber.org/zap"
)

type OfficeSDKConfig struct {
	BaseURL string
}

type OfficeSDK struct {
	client *http.Client
	config OfficeSDKConfig
}

func NewOfficeSDK(config OfficeSDKConfig) OfficeSDK {
	return OfficeSDK{
		client: &http.Client{},
		config: config,
	}
}

func (o OfficeSDK) GetFileContent(fileId string) (string, error) {
	resp, err := o.client.Get(o.config.BaseURL + "/api/office/file/content?fileID=" + fileId)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		elog.Error("read body", zap.Error(err))
		return "", err
	}
	return string(body), nil
}
