package dto

type AiConfig struct {
	ID             int    `json:"id" gorm:"primaryKey;autoIncrement"`
	Name           string `json:"name"`
	BaseUrl        string `json:"baseUrl"`
	TextModel      string `json:"textModel"`
	Token          string `json:"token"`
	ProxyUrl       string `json:"proxyUrl"`
	Subservice     string `json:"subservice"`
	InputMaxToken  int    `json:"inputMaxToken"`
	OutputMaxToken int    `json:"outputMaxToken"`
}

func (a *AiConfig) TableName() string {
	return "ai_configs"
}
