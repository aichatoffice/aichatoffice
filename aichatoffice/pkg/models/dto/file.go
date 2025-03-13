package dto

type File struct {
	ID         int64  `json:"-" gorm:"primaryKey;autoIncrement"`
	FileID     string `json:"id" gorm:"uniqueIndex"` // 唯一索引
	Name       string `json:"name"`
	Version    int64  `json:"version"`
	Type       string `json:"type"`
	Size       int64  `json:"size"`
	CreateTime int64  `json:"create_time"`
	ModifyTime int64  `json:"modify_time"`
	CreatorId  string `json:"creator_id"`
	ModifierId string `json:"modifier_id"`
	Content    []byte `json:"content"`
}

func (f *File) TableName() string {
	return "files"
}
