package invoker

import (
	"fmt"
	"time"

	"github.com/gotomicro/ego/core/econf"
	"github.com/gotomicro/ego/server/egin"

	"aichatoffice/pkg/models/leveldbstore"
	sqlitestore "aichatoffice/pkg/models/sqlite"
	"aichatoffice/pkg/models/store"
	aisvc "aichatoffice/pkg/services/ai"
	chatsvc "aichatoffice/pkg/services/chat"
	filesvc "aichatoffice/pkg/services/file"
	"aichatoffice/ui"
)

var (
	Gin         *egin.Component
	FileService *filesvc.FileService
	ChatService *chatsvc.ChatSvc

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
	aiSvc := aisvc.NewAiWrapper()
	ChatService = chatsvc.NewChatSvc(ChatStore, aiSvc)
	return nil
}

func initStore() (err error) {
	switch econf.GetString("store.type") {
	case "leveldb":
		leveldb, err := leveldbstore.NewLevelDB()
		if err != nil {
			return fmt.Errorf("service init leveldb failed: %w", err)
		}
		FileStore = leveldb
		ChatStore = leveldb
		if econf.GetInt("store.enableExpireJob") > 0 {
			interval := econf.GetDuration("store.expireJobInterval")
			if interval <= 0 {
				interval = 5 * time.Second
			}
			ChatStore.RunDeleteExpireKeysCronjob(interval)
		}
	case "sqlite":
		sqlite, err := sqlitestore.NewSqliteStore()
		if err != nil {
			return fmt.Errorf("service init sqlite failed: %w", err)
		}
		FileStore = sqlite
	default:
		panic(fmt.Sprintf("store type %s not supported", econf.GetString("store.type")))
	}
	return nil
}
