package invoker

import (
	"fmt"

	"github.com/gotomicro/ego/core/econf"
	"github.com/gotomicro/ego/core/elog"
	"github.com/gotomicro/ego/server/egin"

	"aichatoffice/pkg/models/leveldb"
	"aichatoffice/pkg/services"
	aisvc "aichatoffice/pkg/services/ai"
	chatsvc "aichatoffice/pkg/services/chat"
	"aichatoffice/ui"
)

var (
	Gin         *egin.Component
	Leveldb     *leveldb.LevelDB
	FileService *services.FileService
	Chat        *chatsvc.ChatSvc
)

func Init() (err error) {
	fmt.Println("server", econf.GetString("server.port"))
	Gin = egin.Load("server").Build(egin.WithEmbedFs(ui.WebUI))
	Leveldb, err = leveldb.NewLevelDB()
	if err != nil {
		elog.Panic("Failed to initialize Leveldb")
	}
	FileService = services.NewFileService(Leveldb)
	FileService.InitCaseFile()

	chatStore, err := chatsvc.NewChatStore(*Leveldb)
	if err != nil {
		return fmt.Errorf("service init chat store failed: %w", err)
	}

	aiSvc := aisvc.NewAiWrapper()
	Chat = chatsvc.NewChatSvc(chatStore, aiSvc)
	return nil
}
