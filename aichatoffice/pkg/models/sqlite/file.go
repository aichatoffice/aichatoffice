package sqlitestore

import (
	"context"
	"errors"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"aichatoffice/pkg/models/dto"
)

func (s *SqliteStore) GetFileMeta(ctx context.Context, fileID string) (file dto.FileMeta, err error) {
	err = s.DB.Where("file_id = ?", fileID).First(&file).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return dto.FileMeta{}, errors.New("record not found")
		}
		return dto.FileMeta{}, err
	}
	return
}

func (s *SqliteStore) SetFileMeta(ctx context.Context, f dto.FileMeta) error {
	return s.DB.Clauses(
		clause.OnConflict{
			Columns:   []clause.Column{{Name: "file_id"}},
			UpdateAll: true,
		},
	).Create(&f).Error
}

func (s *SqliteStore) DeleteFileMeta(ctx context.Context, fileID string) error {
	return s.DB.Delete(&dto.FileMeta{}, "file_id = ?", fileID).Error
}

func (s *SqliteStore) GetFilesList(ctx context.Context) (files []dto.FileMeta, err error) {
	query := `
		file_id NOT LIKE ? AND
		file_id NOT LIKE ? AND
		file_id NOT LIKE ? AND
		file_id NOT LIKE ?
	`
	err = s.DB.
		Where(query, "%custom_tool%", "%ai%", "%convert_%", "%case_%").
		Find(&files).Error

	return files, err
}
