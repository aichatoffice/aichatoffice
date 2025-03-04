package leveldbstore

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/syndtr/goleveldb/leveldb"

	"aichatoffice/pkg/models/dto"
)

func (l *LevelDBStore) GetFile(ctx context.Context, fileID string) (file dto.File, err error) {
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

func (l *LevelDBStore) SetFile(ctx context.Context, f dto.File) error {
	data, err := json.Marshal(f)
	if err != nil {
		return err
	}
	return l.DB.Put([]byte(f.FileID), data, nil)
}

func (l *LevelDBStore) DeleteFile(ctx context.Context, fileID string) error {
	return l.DB.Delete([]byte(fileID), nil)
}

func (l *LevelDBStore) GetFilesList(ctx context.Context) (files []dto.File, err error) {
	iter := l.DB.NewIterator(nil, nil)
	defer iter.Release()
	for iter.Next() {
		key := string(iter.Key())
		fmt.Println(key, "key")
		if key == "" || strings.HasPrefix(key, "custom_tool") || strings.HasPrefix(key, "ai") || strings.HasPrefix(key, "convert_") || strings.HasPrefix(key, "case_") {
			continue
		}
		metaData, err := l.GetFile(ctx, key)
		if err != nil {
			continue // 跳过无法访问的文件
		}
		files = append(files, metaData)
	}

	if err = iter.Error(); err != nil {
		return nil, err
	}
	return files, nil
}
