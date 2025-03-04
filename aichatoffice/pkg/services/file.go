package services

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/gabriel-vasile/mimetype"
	"github.com/gin-gonic/gin"
	"github.com/gotomicro/ego/core/econf"
	"github.com/gotomicro/ego/core/elog"

	"aichatoffice/pkg/models/dto"
	"aichatoffice/pkg/models/store"
)

type FileService struct {
	store store.FileStore
}

func NewFileService(s store.FileStore) *FileService {
	return &FileService{
		store: s,
	}
}

func (f *FileService) InitCaseFile() {
	// 遍历目录中的所有文件
	err := filepath.Walk(econf.GetString("case.resourcePath"), func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		// 忽略目录，只处理文件
		if info.IsDir() {
			return nil
		}
		// 读取文件内容
		data, err := os.ReadFile(path)
		if err != nil {
			log.Printf("无法读取文件 %s: %v", path, err)
			return nil
		}
		fileName := filepath.Base(path)

		// 使用相对路径作为键，将文件内容作为值存入LevelDB
		key := fmt.Sprintf("case_%s", fileName)
		err = f.store.SetFile(context.Background(), key, dto.File{
			ID:         key,
			Name:       fileName,
			CreateTime: time.Now().Unix(),
			Content:    data,
			Size:       info.Size(),
			Type:       mimetype.Detect(data).String(),
		})
		if err != nil {
			elog.Panic(fmt.Sprintf("存储文件 %s 到LevelDB 失败: %v", path, err))
		} else {
			fmt.Printf("文件 %s 内容已存储到LevelDB。\n", path)
		}
		return nil
	})

	// 如果遍历过程中发生错误
	if err != nil {
		elog.Panic(fmt.Sprintf("遍历目录时发生错误: %v", err))
	}
}

func (f *FileService) GetFilesList(c *gin.Context) (files []dto.File, err error) {
	return f.store.GetFilesList(c)
}

func (f *FileService) UploadFile(c *gin.Context, file dto.File) error {
	return f.store.SetFile(c, file.ID, file)
}

func (f *FileService) GetFile(c *gin.Context, fileId string) (file dto.File, err error) {
	return f.store.GetFile(c, fileId)
}

func (f *FileService) GetDownloadUrl(fileId string) (url string) {
	host := econf.GetString("host.downloadUrlPrefix")
	return fmt.Sprintf("%s/showcase/%s/download", host, fileId)
}

func (f *FileService) DeleteFile(c *gin.Context, fileId string) (err error) {
	return f.store.DeleteFile(c, fileId)
}
