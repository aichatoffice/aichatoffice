package main

import (
	"fmt"
	"os"

	"aichatoffice/cmd"
	_ "aichatoffice/cmd"
	_ "aichatoffice/cmd/server"
)

func main() {
	if err := cmd.RootCommand.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	return
}
