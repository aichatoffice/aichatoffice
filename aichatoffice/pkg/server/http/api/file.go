package api

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/gabriel-vasile/mimetype"
	"github.com/gin-gonic/gin"
	"github.com/gotomicro/ego/core/econf"

	"aichatoffice/pkg/invoker"
	"aichatoffice/pkg/models/dto"
	"aichatoffice/pkg/utils"
)

func GetFiles(c *gin.Context) {
	files, err := invoker.FileService.GetFilesList(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "GetFilesList failed: " + err.Error()})
		return
	}
	c.JSON(200, files)
}

func GetFile(c *gin.Context) {
	fileId := c.Param("guid")
	if fileId == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to get fileId"})
		return
	}
	file, err := invoker.FileService.GetFileMeta(c, fileId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get file: " + err.Error()})
		return
	}
	c.JSON(200, file)
}

func DeleteFile(c *gin.Context) {
	fileId := c.Param("guid")
	if fileId == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to get fileId"})
		return
	}
	err := invoker.FileService.DeleteFile(c, fileId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete file: " + err.Error()})
		return
	}
	c.JSON(204, nil)
}

func UploadFile(c *gin.Context) {
	_file, err := c.FormFile("file")
	if err != nil {
		c.JSON(400, gin.H{"error": "Failed to get file from form"})
		return
	}
	file, err := _file.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "file open failed"})
		return
	}
	defer file.Close()
	content, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "file read failed"})
	}
	mimeType := mimetype.Detect(content).String()
	fileName := _file.Filename
	ext := filepath.Ext(fileName)
	f := dto.FileMeta{
		Name:       fileName,
		Size:       int64(len(content)),
		FileID:     utils.GenFileGuid(),
		Type:       mimeType,
		CreateTime: time.Now().Unix(),
		Ext:        ext,
	}
	err = invoker.FileService.UploadFile(c, f, content)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "file upload failed" + err.Error()})
	}
	c.JSON(200, f)
}

func UploadPathFile(c *gin.Context) {
	fileId := c.Param("guid")
	path := c.Query("path")
	outFile, err := os.Create(fmt.Sprintf("%s/%s%s", econf.GetString("case.filepath"), fileId, path))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": path + "file upload failed" + err.Error()})
	}
	// 将 Body 直接写入文件
	if _, err := io.Copy(outFile, c.Request.Body); err != nil {
		c.String(http.StatusInternalServerError, "failed to write file: %v", err)
		return
	}
	c.JSON(200, nil)
}

func DownloadPathFile(c *gin.Context) {
	fileId := c.Param("guid")
	file, err := invoker.FileService.GetFileMeta(c, fileId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "get file error: " + err.Error()})
		return
	}
	path := c.Query("path")
	disposition := c.Query("disposition")
	if disposition == "" {
		disposition = "attachment"
	}
	content, err := os.ReadFile(fmt.Sprintf("%s/%s%s", econf.GetString("case.filepath"), fileId, path))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": path + "file read failed" + err.Error()})
	}
	c.Header("Content-Type", file.Type)
	c.Header("Content-Disposition", fmt.Sprintf("%s; filename=\"%s\"", disposition, file.Name))
	c.Data(200, file.Type, content)
}

func DownloadFile(c *gin.Context) {
	fileId := c.Param("guid")
	if fileId == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to get fileId"})
		return
	}
	file, err := invoker.FileService.GetFileMeta(c, fileId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "get file error: " + err.Error()})
		return
	}
	content, err := invoker.FileService.GetFileContent(c, fileId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "get file content error: " + err.Error()})
		return
	}

	c.Header("Content-Type", file.Type)
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", file.Name))
	c.Data(200, file.Type, content)
}

func GetPageParams(c *gin.Context) {
	fileId := c.Param("guid")
	if fileId == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to get fileId"})
		return
	}
	file, err := invoker.FileService.GetFileMeta(c, fileId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get file: " + err.Error()})
		return
	}
	c.JSON(200, gin.H{
		"file":     file,
		"endpoint": econf.GetString("host.previewUrlPrefix"),
		"token":    utils.SignJWT(1, 0),
	})
}
