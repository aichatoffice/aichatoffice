package aisvc

import (
	"aichatoffice/pkg/models/dto"
	"aichatoffice/pkg/models/store"
	"context"
)

type AiConfigSvc struct {
	store store.AiConfigStore
}

func NewAiConfigSvc(store store.AiConfigStore) *AiConfigSvc {
	return &AiConfigSvc{
		store: store,
	}
}

func (s *AiConfigSvc) GetAIConfig(ctx context.Context) ([]dto.AiConfig, error) {
	return s.store.GetAIConfig(ctx)
}

func (s *AiConfigSvc) UpdateAIConfig(ctx context.Context, aiConfig []dto.AiConfig) error {
	return s.store.UpdateAIConfig(ctx, aiConfig)
}
