package api

import (
	"aichatoffice/pkg/invoker"
	"aichatoffice/pkg/models/dto"
	"net/http"

	aisvc "aichatoffice/pkg/services/ai"

	"github.com/gin-gonic/gin"
)

func GetAIConfig(ctx *gin.Context) {
	aiConfigs, err := invoker.AiConfigSvc.GetAIConfig(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, aiConfigs)
}

func UpdateAIConfig(ctx *gin.Context) {
	aiConfigs := []dto.AiConfig{}
	err := ctx.ShouldBindJSON(&aiConfigs)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	err = invoker.AiConfigSvc.UpdateAIConfig(ctx, aiConfigs)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	// 更新后重新初始化 ai 服务
	aiSvc, err := aisvc.NewOpenAI(invoker.AiConfigSvc)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	invoker.ChatService.AiSvc = aiSvc
	ctx.JSON(http.StatusOK, aiConfigs)
}
