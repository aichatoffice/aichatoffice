package invoker

import (
	"fmt"
	"time"

	"github.com/gotomicro/ego/core/econf"
	"github.com/gotomicro/ego/server/egin"

	"aichatoffice/pkg/models/leveldbstore"
	"aichatoffice/pkg/models/store"
	"aichatoffice/pkg/services"
	aisvc "aichatoffice/pkg/services/ai"
	chatsvc "aichatoffice/pkg/services/chat"
	"aichatoffice/ui"
)

var (
	Gin         *egin.Component
	FileService *services.FileService
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
	}
	return nil
}
