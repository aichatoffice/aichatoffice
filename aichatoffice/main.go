package main

import (
	"fmt"
	"os"

	"turbo-demo/cmd"
	_ "turbo-demo/cmd"
	_ "turbo-demo/cmd/server"
)

func main() {
	if err := cmd.RootCommand.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	return
}
