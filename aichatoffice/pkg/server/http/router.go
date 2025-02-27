package http

import (
	"github.com/gotomicro/ego/server/egin"

	"turbo-demo/pkg/invoker"
	"turbo-demo/pkg/server/http/api"
	"turbo-demo/pkg/server/http/callback"
	"turbo-demo/pkg/server/http/middlewares"
	"turbo-demo/ui"
)

func ServeHTTP() *egin.Component {
	r := invoker.Gin
	r.Use(middlewares.CORS())
	apiRouters := r.Group("/showcase")
	{
		// 文件操作
		apiRouters.GET("/files", api.GetFiles)
		apiRouters.GET("/files/:guid", api.GetFile)
		apiRouters.DELETE("/file/:guid", api.DeleteFile)
		apiRouters.POST("/file", api.UploadFile)
		apiRouters.GET("/:guid/download", api.DownloadFile)
		apiRouters.GET("/:guid/preview/url", api.GetPreviewUrl)
	}
	// 回调接口
	callbackRouter := r.Group("/v1/callback")
	{
		// 鉴权
		callbackRouter.POST("/verify/:fileId", callback.Verify)
		// 预览回调
		callbackRouter.GET("/files/:fileId", callback.GetFile)
		callbackRouter.GET("/files/:fileId/download", callback.GetFileDownload)
		callbackRouter.GET("/files/:fileId/watermark", callback.GetFileWatermark)
		// 编辑回调
		callbackRouter.POST("/files/:fileId/upload/address", callback.UploadAddress)
		callbackRouter.POST("/files/:fileId/upload/complete", callback.UploadComplete)
		callbackRouter.PUT("/files/:fileId/upload", callback.UploadFile)
		// ai 回调
		callbackRouter.POST("/chat/aiConfig", callback.AIConfig)
	}
	r.Use(middlewares.Serve("/", middlewares.EmbedFolder(ui.WebUI, "dist"), false))
	r.Use(middlewares.Serve("/", middlewares.FallbackFileSystem(middlewares.EmbedFolder(ui.WebUI, "dist")), true))
	return r
}
