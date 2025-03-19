package cmd

import (
	"os"

	"github.com/spf13/cobra"
)

// Config config路径
var config string

func init() {
	confEnv := os.Getenv("EGO_CONFIG_PATH")
	if confEnv == "" {
		confEnv = "config/local.toml"
	}
	RootCommand.PersistentFlags().StringVarP(&config, "config", "c", confEnv, "指定配置文件，默认 config/local.toml")
}

var RootCommand = &cobra.Command{
	Use: "aichatoffice",
}
