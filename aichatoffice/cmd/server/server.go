package server

import (
	"github.com/gotomicro/ego"
	"github.com/gotomicro/ego/core/elog"
	"github.com/spf13/cobra"
	_ "go.uber.org/automaxprocs"

	"turbo-demo/pkg/invoker"
	httpServer "turbo-demo/pkg/server/http"

	"turbo-demo/cmd"
)

var CmdRun = &cobra.Command{
	Use:   "server",
	Short: "启动 turbo-demo http 服务端",
	Long:  `启动 turbo-demo http 服务端`,
	Run:   CmdFunc,
}

func init() {
	CmdRun.InheritedFlags()
	cmd.RootCommand.AddCommand(CmdRun)
}

func CmdFunc(cmd *cobra.Command, args []string) {
	e := ego.New()
	e.Invoker(invoker.Init)

	if err := e.Serve(
		httpServer.ServeHTTP(),
	).Run(); err != nil {
		elog.Panic("Startup failed", elog.FieldErr(err))
	}
}
