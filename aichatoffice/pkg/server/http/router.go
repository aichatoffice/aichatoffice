package http

import (
	"github.com/gotomicro/ego/server/egin"
	"github.com/officesdk/go-sdk/officesdk"

	"aichatoffice/pkg/invoker"
	"aichatoffice/pkg/server/http/api"
	"aichatoffice/pkg/server/http/callback"
	"aichatoffice/pkg/server/http/middlewares"
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
		apiRouters.GET("/:guid/page", api.GetPageParams)

		apiRouters.PUT("/:guid/upload/path", api.UploadPathFile)
		apiRouters.GET("/:guid/download/path", api.DownloadPathFile)
	}

	// 为 officesdk 添加鉴权中间件
	authMiddleware := middlewares.Auth()
	r.Use(authMiddleware)
	officesdk.NewServer(officesdk.Config{
		FileProvider: &callback.FileProvider{},
		AIProvider:   &callback.AIProvider{},
		Prefix:       "",
	}, r.Engine)

	// ai-chat路由
	apiGroup := r.Group("/api")
	// chatRouters := apiGroup.Group("/chat")
	// {
	// 	chatRouters.Use(middlewares.ChatUser())
	// 	chatRouters.POST("", api.NewConversation)
	// 	chatRouters.GET("/:conversation_id", api.GetConversation)
	// 	chatRouters.DELETE("/:conversation_id", api.DeleteConversation)
	// 	chatRouters.POST("/:conversation_id/break", api.BreakConversation)
	// 	chatRouters.POST("/:conversation_id/chat", api.Chat)
	// }

	chatRouters := apiGroup.Group("/chat")
	{
		chatRouters.Use(middlewares.ChatUser())
		chatRouters.GET("/:fileId/conversation", api.GetConversation)
		chatRouters.POST("/:conversation_id/chat", api.Completions)
	}

	aiRouters := apiGroup.Group("/ai")
	{
		aiRouters.GET("/config", api.GetAIConfig)
		aiRouters.POST("/config", api.UpdateAIConfig)
	}

	r.Use(middlewares.Serve("/", middlewares.EmbedFolder(ui.WebUI, "dist"), false))
	r.Use(middlewares.Serve("/", middlewares.FallbackFileSystem(middlewares.EmbedFolder(ui.WebUI, "dist")), true))
	return r
}
