package filesvc

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
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
		ext := filepath.Ext(fileName)
		err = f.store.SetFileMeta(context.Background(), dto.FileMeta{
			FileID:     key,
			Name:       fileName,
			CreateTime: time.Now().Unix(),
			Size:       info.Size(),
			Type:       mimetype.Detect(data).String(),
			Ext:        ext,
		})
		if err != nil {
			elog.Panic(fmt.Sprintf("存储文件 %s 到Store 失败: %v", path, err))
		} else {
			fmt.Printf("文件 %s 内容已存储到Store。\n", path)
		}
		return nil
	})

	// 如果遍历过程中发生错误
	if err != nil {
		elog.Panic(fmt.Sprintf("遍历目录时发生错误: %v", err))
	}
}

func (f *FileService) GetFilesList(c *gin.Context) (files []dto.FileMeta, err error) {
	return f.store.GetFilesList(c)
}

func (f *FileService) UploadFile(c *gin.Context, file dto.FileMeta, content []byte) error {
	// 存储文件元数据
	err := f.store.SetFileMeta(c, file)
	if err != nil {
		return err
	}
	// 存储文件内容
	return f.WriteBytesToFile(content, UploadFilePath(file.FileID, file.Ext))
}

func (f *FileService) GetFileMeta(c *gin.Context, fileId string) (file dto.FileMeta, err error) {
	return f.store.GetFileMeta(c, fileId)
}

func (f *FileService) CheckContentExist(c *gin.Context, fileId string) bool {
	dirPath := fmt.Sprintf("%s/%s/content", econf.GetString("case.filepath"), fileId)
	// 检查是否存在
	_, err := os.Stat(dirPath)
	if os.IsNotExist(err) {
		return false // 路径不存在
	}
	if err != nil {
		return false // 其他错误
	}
	return true
}

func (f *FileService) GetDownloadUrl(fileId string) (url string) {
	host := econf.GetString("host.downloadUrlPrefix")
	return fmt.Sprintf("%s/showcase/%s/download", host, fileId)
}

func (f *FileService) GetUploadPathUrl(fileId string, path string) (url string) {
	host := econf.GetString("host.downloadUrlPrefix")
	return fmt.Sprintf("%s/showcase/%s/upload/path?path=%s", host, fileId, path)
}

func (f *FileService) GetDownloadPathUrl(fileId string, path string, disposition string) (url string) {
	host := econf.GetString("host.downloadUrlPrefix")
	return fmt.Sprintf("%s/showcase/%s/download/path?path=%s&disposition=%s", host, fileId, path, disposition)
}

func (f *FileService) DeleteFile(c *gin.Context, fileId string) (err error) {
	err = f.store.DeleteFileMeta(c, fileId)
	if err != nil {
		return err
	}
	return f.DeleteFileContent(fmt.Sprintf("%s/%s", econf.GetString("case.filepath"), fileId))
}

// WriteBytesToFile 将字节数据写入指定文件，如果目录或文件不存在则创建
func (f *FileService) WriteBytesToFile(data []byte, filePath string) error {
	// 获取文件所在目录
	dir := filepath.Dir(filePath)

	// 检查目录是否存在，如果不存在则创建
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		err = os.MkdirAll(dir, 0755) // 创建目录，权限为 0755
		if err != nil {
			return err
		}
	}

	// 写入文件，如果文件不存在则创建，权限为 0644
	err := os.WriteFile(filePath, data, 0644)
	if err != nil {
		return err
	}

	return nil
}

func (f *FileService) DeleteFileContent(filePath string) (err error) {
	// 检查路径是否存在
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return nil // 如果文件不存在，直接返回成功
	}

	// 尝试删除文件或目录
	err = os.RemoveAll(filePath)
	if err != nil {
		return fmt.Errorf("删除文件失败: %v", err)
	}
	return nil
}

func (f *FileService) GetFileContent(c *gin.Context, fileId string) (content []byte, err error) {
	file, err := f.store.GetFileMeta(c, fileId)
	if err != nil {
		return nil, err
	}
	filePath := ""
	if strings.HasPrefix(fileId, "case_") {
		filePath = ResourceFilePath(fileId[5:], file.Ext)
	} else {
		filePath = UploadFilePath(fileId, file.Ext)
	}
	return os.ReadFile(filePath)
}

func UploadFilePath(fileID string, fileExt string) string {
	return filepath.Join(econf.GetString("case.filepath"), fileID, fmt.Sprintf("source%s", fileExt))
}

func ResourceFilePath(fileID string, fileExt string) string {
	return filepath.Join(econf.GetString("case.resourcePath"), fileID, fileExt)
}
