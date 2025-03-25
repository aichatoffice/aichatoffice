package officesvc

type OfficeSvc interface {
	GetFileContent(fileId string) (string, error)
}
