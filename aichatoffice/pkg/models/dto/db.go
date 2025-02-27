package dto

type File struct {
	ID         string `json:"id"`
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
