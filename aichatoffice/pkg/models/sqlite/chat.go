package sqlitestore

import (
	"context"
	"time"

	"aichatoffice/pkg/models/dto"
)

const (
	conversationTTL = 7 * 24 * time.Hour
	messageTTL      = 7 * 24 * time.Hour
	stopKeyTTL      = time.Minute * 10
)

func (s *SqliteStore) NewConversation(ctx context.Context, userId string, conversationId string, system string, fileGuid string) error {
	// key := s.conversationKey(userId, conversationId)
	// // check if conversation exists
	// var count int64
	// err := s.DB.Model(&dto.ChatConversation{}).Where("user_id = ? AND conversation_id = ?", userId, conversationId).Count(&count).Error
	// if err != nil {
	// 	elog.Error("NewConversation_error has key", elog.FieldErr(err), l.S("key", key))
	// 	return err
	// }
	// if count > 0 {
	// 	return errors.New("conversation exists")
	// }

	// // todo 写入过期时间
	// info := &dto.ChatConversation{
	// 	ConversationId: conversationId,
	// 	System:         system,
	// 	FileGuid:       fileGuid,
	// 	UserId:         userId,
	// }
	// // set info
	// err = s.DB.Create(info).Error
	// if err != nil {
	// 	return err
	// }
	return nil
}

// GetConversation get all conversation messages from sqlite
func (s *SqliteStore) GetConversation(ctx context.Context, userId string, conversationId string) (*dto.ChatConversation, error) {
	// var info dto.ChatConversation
	// err := s.DB.Where("user_id = ? AND conversation_id = ?", userId, conversationId).First(&info).Error
	// if err != nil {
	// 	elog.Error("GetConversation_error get info", elog.FieldErr(err), l.S("userId", userId), l.S("conversationId", conversationId))
	// 	return nil, err
	// }

	// var msgs []dto.ChatMessageDO
	// err = s.DB.Where("user_id = ? AND conversation_id = ?", userId, conversationId).Order("created ASC").Find(&msgs).Error
	// if err != nil {
	// 	elog.Error("GetConversation_error get messages", elog.FieldErr(err), l.S("userId", userId), l.S("conversationId", conversationId))
	// 	return nil, err
	// }
	// info.Messages = msgs
	// return &info, nil
	return nil, nil
}

// AddMessage add message to conversation
func (s *SqliteStore) AddMessage(ctx context.Context, userId string, conversationId string, chatInput string) error {
	// msg := dto.ChatMessageDO{
	// 	UserId:         userId,
	// 	ConversationId: conversationId,
	// 	Content:        chatInput,
	// 	Role:           "user",
	// 	Created:        time.Now().Unix(),
	// }
	// return s.DB.Create(&msg).Error
	return nil
}

// BreakConversation break conversation by set a stop key
func (s *SqliteStore) BreakConversation(ctx context.Context, userId string, conversationId string) error {
	// key := s.conversationKey(userId, conversationId)
	// // set stop key
	// err := s.DB.Put([]byte(key+":stop"), []byte("1"), nil)
	// if err != nil {
	// 	elog.Error("BreakConversation_error put stop key", elog.FieldErr(err), l.S("key", key))
	// 	return err
	// }

	// err = s.EXPIRE(key, stopKeyTTL)
	// if err != nil {
	// 	elog.Error("BreakConversation_error expire", elog.FieldErr(err), l.S("key", key))
	// 	return err
	// }
	return nil
}

// IsConversationBreak check if conversation is break
func (s *SqliteStore) IsConversationBreak(ctx context.Context, userId string, conversationId string) (bool, error) {
	// key := s.conversationKey(userId, conversationId)
	// // check stop key
	// exists, err := s.DB.Has([]byte(key+":stop"), nil)
	// if err != nil {
	// 	return false, err
	// }
	// return exists, nil
	return false, nil
}

// ResumeConversation resume conversation by remove stop key
func (s *SqliteStore) ResumeConversation(ctx context.Context, userId string, conversationId string) error {
	// key := s.conversationKey(userId, conversationId)
	// // remove stop key
	// err := s.DB.Delete([]byte(key+":stop"), nil)
	// return err
	return nil
}

// CountConversation count all conversations from one user
func (s *SqliteStore) CountConversation(ctx context.Context, userId string) (int, error) {
	// var count int64
	// err := s.DB.Model(&dto.ChatConversation{}).Where("user_id = ?", userId).Count(&count).Error
	// if err != nil {
	// 	return 0, err
	// }
	// return int(count), nil
	return 0, nil
}

// DeleteConversation delete conversation
func (s *SqliteStore) DeleteConversation(ctx context.Context, userId string, conversationId string) error {
	// err := s.DB.Where("user_id = ? AND conversation_id = ?", userId, conversationId).Delete(&dto.ChatConversation{}).Error
	// if err != nil {
	// 	elog.Error("DeleteConversation_error delete conversation", elog.FieldErr(err), l.S("userId", userId), l.S("conversationId", conversationId))
	// 	return err
	// }

	// err = s.DB.Where("user_id = ? AND conversation_id = ?", userId, conversationId).Delete(&dto.ChatMessageDO{}).Error
	// if err != nil {
	// 	elog.Error("DeleteConversation_error delete message", elog.FieldErr(err), l.S("userId", userId), l.S("conversationId", conversationId))
	// 	return err
	// }
	return nil
}

func (s *SqliteStore) conversationKey(userId string, conversationId string) string {
	// return fmt.Sprintf("ai:conversation:%s:%s", userId, conversationId)
	return ""
}

func (s *SqliteStore) conversationMessageKey(userId string, conversationId string) string {
	// return fmt.Sprintf("ai:conversation:%s:%s:msgs", userId, conversationId)
	return ""
}

// 实现 redis HSET 功能
func (s *SqliteStore) HSET(mainKey, hashKey, hashValue string) error {
	// _, err := s.DB.Has([]byte(mainKey), nil)
	// if err != nil && !errors.Is(err, leveldb.ErrNotFound) {
	// 	elog.Error("hset_error has mainKey", elog.FieldErr(err), l.S("mainKey", mainKey))
	// 	return err
	// }

	// // 不存在则新建整个 key
	// if err == leveldb.ErrNotFound {
	// 	hash := s.genNewHash()
	// 	hash[hashKey] = hashValue
	// 	hashStr, err := jsoniter.MarshalToString(hash)
	// 	if err != nil {
	// 		elog.Error("hset_error marshal hash", elog.FieldErr(err), l.S("mainKey", mainKey))
	// 		return err
	// 	}
	// 	err = s.DB.Put([]byte(mainKey), []byte(hashStr), nil)
	// 	if err != nil {
	// 		elog.Error("hset_error put hash", elog.FieldErr(err), l.S("mainKey", mainKey), l.S("hashKey", hashKey), l.S("hashValue", hashValue))
	// 		return err
	// 	}
	// } else {
	// 	// 存在则更新 hash
	// 	hash, err := s.HGETALL(mainKey)
	// 	if err != nil {
	// 		elog.Error("hset_error get hash", elog.FieldErr(err), l.S("mainKey", mainKey))
	// 		return err
	// 	}
	// 	hash[hashKey] = hashValue
	// 	hashStr, err := jsoniter.MarshalToString(hash)
	// 	if err != nil {
	// 		elog.Error("hset_error marshal hash", elog.FieldErr(err), l.S("mainKey", mainKey))
	// 		return err
	// 	}
	// 	err = s.DB.Put([]byte(mainKey), []byte(hashStr), nil)
	// 	if err != nil {
	// 		elog.Error("hset_error put hash", elog.FieldErr(err), l.S("mainKey", mainKey))
	// 		return err
	// 	}
	// }
	return nil
}

// 实现 redis HGETALL 功能
func (s *SqliteStore) HGETALL(key string) (map[string]string, error) {
	// values, err := s.DB.Get([]byte(key), nil)
	// if err != nil {
	// 	if errors.Is(err, leveldb.ErrNotFound) {
	// 		return make(map[string]string), nil
	// 	} else {
	// 		elog.Error("hgetall_error get values", elog.FieldErr(err), l.S("key", key))
	// 		return nil, err
	// 	}
	// }
	// var hash map[string]string
	// err = jsoniter.Unmarshal(values, &hash)
	// if err != nil {
	// 	elog.Error("hgetall_error unmarshal values", elog.FieldErr(err), l.S("key", key))
	// 	return nil, err
	// }
	// return hash, nil
	return make(map[string]string), nil
}

// 实现 redis HGET 功能
func (s *SqliteStore) HGET(key, hashKey string) (string, error) {
	// hash, err := s.HGETALL(key)
	// if err != nil {
	// 	elog.Error("hget_error get hash", elog.FieldErr(err), l.S("key", key), l.S("hashKey", hashKey))
	// 	return "", err
	// }
	// return hash[hashKey], nil
	return "", nil
}

const (
	expireMainKey = "custom_tool:expires"
)

// 实现 redis EXPIRE 功能
// 做法是存一个过期时间的 hash，然后业务层做定时任务删除
func (s *SqliteStore) EXPIRE(conversationKey string, ttl time.Duration) error {
	// return s.HSET(expireMainKey, conversationKey, fmt.Sprintf("%d", time.Now().Add(ttl).Unix()))
	return nil
}

// 删除所有过期 key
func (s *SqliteStore) DeleteExpireKeys() error {
	// expireMap, err := s.HGETALL(expireMainKey)
	// if err != nil && !errors.Is(err, leveldb.ErrNotFound) {
	// 	elog.Error("DeleteExpireKeys_error get expireMap", elog.FieldErr(err), l.S("expireMainKey", expireMainKey))
	// 	return err
	// }

	// for conversationKey, timeStr := range expireMap {
	// 	expireTime := cast.ToInt64(timeStr)
	// 	if time.Now().Unix() > expireTime {
	// 		err = s.DB.Delete([]byte(conversationKey), nil)
	// 		if err != nil {
	// 			elog.Error("DeleteExpireKeys_error delete key", elog.FieldErr(err), l.S("key", conversationKey))
	// 		}
	// 		// 从过期 map 中删除
	// 		delete(expireMap, conversationKey)
	// 	}
	// }

	// // 更新过期 map
	// expireStr, err := jsoniter.MarshalToString(expireMap)
	// if err != nil {
	// 	elog.Error("DeleteExpireKeys_error marshal expireMap", elog.FieldErr(err), l.S("expireMainKey", expireMainKey))
	// 	return err
	// }
	// err = s.DB.Put([]byte(expireMainKey), []byte(expireStr), nil)
	// if err != nil {
	// 	elog.Error("DeleteExpireKeys_error put expireMap", elog.FieldErr(err), l.S("expireMainKey", expireMainKey))
	// 	return err
	// }

	// elog.Info("DeleteExpireKeys_success")
	return nil
}

func (s *SqliteStore) RunDeleteExpireKeysCronjob(interval time.Duration) {
	// go func() {
	// 	for {
	// 		time.Sleep(interval)
	// 		s.DeleteExpireKeys()
	// 	}
	// }()
}

func (s *SqliteStore) genNewHash() map[string]string {
	return make(map[string]string)
}
