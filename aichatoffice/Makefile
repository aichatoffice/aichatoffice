APP_NAME:=aichatoffice
APP_PATH:=$(shell dirname $(realpath $(lastword $(MAKEFILE_LIST))))
SCRIPT_PATH:=$(APP_PATH)/scripts
COMPILE_OUT:=$(APP_PATH)/bin/$(APP_NAME)
ELECTRON_SERVER_PATH:=$(APP_PATH)/../app/electron/server

server:export EGO_DEBUG=true
server:export EGO_MODE=dev
server:
	@cd $(APP_PATH) && go run main.go server --config=config/local.toml

build:
	@echo ">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>making build app<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<"
	@chmod +x $(SCRIPT_PATH)/build/*.sh
	@cd $(APP_PATH) && $(SCRIPT_PATH)/build/gobuild.sh $(APP_NAME) $(COMPILE_OUT)
	@echo -e "\n"

# 为 macOS arm64 构建
build-darwin-arm64:
	@echo ">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>building for macOS arm64<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<"
	@chmod +x $(SCRIPT_PATH)/build/*.sh
	@cd $(APP_PATH) && GOOS=darwin GOARCH=arm64 $(SCRIPT_PATH)/build/gobuild.sh $(APP_NAME) $(ELECTRON_SERVER_PATH)/$(APP_NAME)-arm64
	@echo "Build complete: $(ELECTRON_SERVER_PATH)/$(APP_NAME)-arm64 	\n"

# 为 macOS x64 构建
build-darwin-x64:
	@echo ">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>building for macOS x64<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<"
	@chmod +x $(SCRIPT_PATH)/build/*.sh
	@cd $(APP_PATH) && GOOS=darwin GOARCH=amd64 $(SCRIPT_PATH)/build/gobuild.sh $(APP_NAME) $(ELECTRON_SERVER_PATH)/$(APP_NAME)-x64
	@echo "Build complete: $(ELECTRON_SERVER_PATH)/$(APP_NAME)-x64 	\n"

# 清理构建文件
clean:
	@rm -f $(ELECTRON_SERVER_PATH)/$(APP_NAME)-arm64
	@rm -f $(ELECTRON_SERVER_PATH)/$(APP_NAME)-x64
	@echo ">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>Cleaned build files<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<"