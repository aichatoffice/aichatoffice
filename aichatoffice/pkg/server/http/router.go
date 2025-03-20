package http

import (
	"github.com/gotomicro/ego/server/egin"

	"aichatoffice/pkg/invoker"
	"aichatoffice/pkg/server/http/api"
	"aichatoffice/pkg/server/http/callback"
	"aichatoffice/pkg/server/http/middlewares"
	aiv2svc "aichatoffice/pkg/services/aiv2"
	"aichatoffice/ui"
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
		callbackRouter.GET("/verify/:fileId", callback.Verify)
		// 预览回调
		callbackRouter.GET("/files/:fileId", callback.GetFile)
		callbackRouter.GET("/files/:fileId/download", callback.GetFileDownload)
		callbackRouter.GET("/files/:fileId/watermark", callback.GetFileWatermark)
		// 编辑回调
		callbackRouter.POST("/files/:fileId/upload/address", callback.UploadAddress)
		callbackRouter.POST("/files/:fileId/upload/complete", callback.UploadComplete)
		callbackRouter.PUT("/files/:fileId/upload", callback.UploadFile)
		// ai 回调
		callbackRouter.GET("/chat/aiConfig", callback.AIConfig)
	}

	// ai-chat路由
	apiGroup := r.Group("/api")
	chatRouters := apiGroup.Group("/chat")
	{
		chatRouters.Use(middlewares.ChatUser())
		chatRouters.POST("", api.NewConversation)
		chatRouters.GET("/:conversation_id", api.GetConversation)
		chatRouters.DELETE("/:conversation_id", api.DeleteConversation)
		chatRouters.POST("/:conversation_id/break", api.BreakConversation)
		chatRouters.POST("/:conversation_id/chat", api.Chat)
	}

	chatV2Routers := apiGroup.Group("/chatv2")
	{
		chatV2Routers.POST("/:conversation_id/chat", aiv2svc.Completions)
	}

	r.Use(middlewares.Serve("/", middlewares.EmbedFolder(ui.WebUI, "dist"), false))
	r.Use(middlewares.Serve("/", middlewares.FallbackFileSystem(middlewares.EmbedFolder(ui.WebUI, "dist")), true))
	return r
}
