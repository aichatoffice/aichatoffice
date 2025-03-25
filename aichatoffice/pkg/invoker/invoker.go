package invoker

import (
	"fmt"

	"github.com/gotomicro/ego/core/econf"
	"github.com/gotomicro/ego/server/egin"

	sqlitestore "aichatoffice/pkg/models/sqlite"
	"aichatoffice/pkg/models/store"
	aisvc "aichatoffice/pkg/services/ai"
	chatsvc "aichatoffice/pkg/services/chat"
	filesvc "aichatoffice/pkg/services/file"
	officesvc "aichatoffice/pkg/services/office"
	"aichatoffice/ui"
)

var (
	Gin         *egin.Component
	FileService *filesvc.FileService
	ChatService *chatsvc.ChatSvc
	OfficeSvc   officesvc.OfficeSvc

	// store
	FileStore store.FileStore
	ChatStore store.ChatStore
)

func Init() (err error) {
	Gin = egin.Load("server").Build(egin.WithEmbedFs(ui.WebUI))
	err = initStore()
	if err != nil {
		return fmt.Errorf("service init store failed: %w", err)
	}

	FileService = filesvc.NewFileService(FileStore)
	FileService.InitCaseFile()

	// todo 支持多种 ai 协议，可根据配置切换
	aiSvc, err := aisvc.NewOpenAI()
	if err != nil {
		return fmt.Errorf("service init ai failed: %w", err)
	}
	OfficeSvc = officesvc.NewOfficeSDK(officesvc.OfficeSDKConfig{
		BaseURL: "http://localhost:9101", //todo 放到哪个配置里
	})
	ChatService = chatsvc.NewChatSvc(ChatStore, aiSvc, OfficeSvc)

	return nil
}

func initStore() (err error) {
	switch econf.GetString("store.type") {
	case "sqlite":
		sqlite, err := sqlitestore.NewSqliteStore()
		if err != nil {
			return fmt.Errorf("service init sqlite failed: %w", err)
		}
		FileStore = sqlite
		ChatStore = sqlite
	default:
		panic(fmt.Sprintf("store type %s not supported", econf.GetString("store.type")))
	}
	return nil
}
