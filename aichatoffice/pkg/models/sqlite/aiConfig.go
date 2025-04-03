package sqlitestore

import (
	"aichatoffice/pkg/models/dto"
	"context"

	"gorm.io/gorm"
)

func (s *SqliteStore) GetAIConfig(ctx context.Context) (aiConfig []dto.AiConfig, err error) {
	err = s.DB.Find(&aiConfig).Error
	return
}

func (s *SqliteStore) UpdateAIConfig(ctx context.Context, aiConfig []dto.AiConfig) error {
	return s.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec("DELETE FROM ai_configs").Error; err != nil {
			return err
		}
		if len(aiConfig) > 0 {
			return tx.Create(&aiConfig).Error
		}
		return nil
	})
}
