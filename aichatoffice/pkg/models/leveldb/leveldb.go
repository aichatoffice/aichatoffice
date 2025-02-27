package leveldb

import (
	"encoding/json"
	"errors"
	"fmt"

	"turbo-demo/pkg/models/dto"

	"github.com/gotomicro/ego/core/econf"
	"github.com/syndtr/goleveldb/leveldb"
)

type LevelDB struct {
	DB *leveldb.DB
}

func NewLevelDB() (*LevelDB, error) {
	fmt.Println("leveldb.path", econf.GetString("leveldb.path"))
	db, err := leveldb.OpenFile(econf.GetString("leveldb.path"), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to open leveldb: %v", err)
	}
	return &LevelDB{
		DB: db,
	}, nil
}

func (l *LevelDB) GetFile(fileID string) (file dto.File, err error) {
	data, err := l.DB.Get([]byte(fileID), nil)
	if err != nil {
		if errors.Is(err, leveldb.ErrNotFound) {
			return dto.File{}, errors.New("record not found")
		}
		return dto.File{}, err
	}
	err = json.Unmarshal(data, &file)
	if err != nil {
		return dto.File{}, err
	}
	return
}

func (l *LevelDB) SetFile(fileID string, f dto.File) error {
	data, err := json.Marshal(f)
	if err != nil {
		return err
	}
	return l.DB.Put([]byte(fileID), data, nil)
}

func (l *LevelDB) DeleteFile(fileID string) error {
	return l.DB.Delete([]byte(fileID), nil)
}
