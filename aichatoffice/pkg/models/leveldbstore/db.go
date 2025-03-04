package leveldbstore

import (
	"fmt"

	"github.com/gotomicro/ego/core/econf"
	"github.com/syndtr/goleveldb/leveldb"
)

type LevelDBStore struct {
	DB *leveldb.DB
}

func NewLevelDB() (*LevelDBStore, error) {
	fmt.Println("leveldb.path", econf.GetString("leveldb.path"))
	db, err := leveldb.OpenFile(econf.GetString("leveldb.path"), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to open leveldb: %v", err)
	}
	return &LevelDBStore{
		DB: db,
	}, nil
}
