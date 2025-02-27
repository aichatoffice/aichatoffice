package invoker

import (
	"fmt"
	"turbo-demo/pkg/models/leveldb"
	"turbo-demo/pkg/services"
	"turbo-demo/ui"

	"github.com/gotomicro/ego/core/econf"
	"github.com/gotomicro/ego/core/elog"
	"github.com/gotomicro/ego/server/egin"
)

var (
	Gin         *egin.Component
	Leveldb     *leveldb.LevelDB
	FileService *services.FileService
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
	return nil
}
