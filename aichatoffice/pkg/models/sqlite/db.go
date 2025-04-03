package sqlitestore

import (
	"github.com/gotomicro/ego/core/econf"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"aichatoffice/pkg/models/dto"
)

type SqliteStore struct {
	DB *gorm.DB
}

func NewSqliteStore() (*SqliteStore, error) {
	db, err := gorm.Open(sqlite.Open(econf.GetString("sqlite.path")), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	s := &SqliteStore{
		DB: db,
	}
	err = s.AutoMigrate()
	if err != nil {
		return nil, err
	}
	return s, nil
}

func (s *SqliteStore) AutoMigrate() error {
	// 文件存储
	err := s.DB.AutoMigrate(&dto.File{})
	if err != nil {
		return err
	}
	// 对话存储
	err = s.DB.AutoMigrate(&dto.ChatConversation{})
	if err != nil {
		return err
	}
	err = s.DB.AutoMigrate(&dto.ChatMessage{})
	if err != nil {
		return err
	}
	// ai 模型配置存储
	err = s.DB.AutoMigrate(&dto.AiConfig{})
	if err != nil {
		return err
	}
	return nil
}
