package sqlitestore

import (
	"context"
	"errors"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"aichatoffice/pkg/models/dto"
)

func (s *SqliteStore) GetFile(ctx context.Context, fileID string) (file dto.File, err error) {
	err = s.DB.Where("file_id = ?", fileID).First(&file).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return dto.File{}, errors.New("record not found")
		}
		return dto.File{}, err
	}
	return
}

func (s *SqliteStore) SetFile(ctx context.Context, f dto.File) error {
	return s.DB.Clauses(
		clause.OnConflict{
			Columns:   []clause.Column{{Name: "file_id"}},
			UpdateAll: true,
		},
	).Create(&f).Error
}

func (s *SqliteStore) DeleteFile(ctx context.Context, fileID string) error {
	return s.DB.Where("file_id = ?", fileID).Delete(&dto.File{}).Error
}

func (s *SqliteStore) GetFilesList(ctx context.Context) (files []dto.File, err error) {
	//TODO 优化
	err = s.DB.Find(&files).Where("file_id NOT LIKE ?", "%custom_tool%").Where("file_id NOT LIKE ?", "%ai%").Where("file_id NOT LIKE ?", "%convert_%").Where("file_id NOT LIKE ?", "%case_%").Error
	return files, err
}
