package dto

//todo 移走
import "errors"

var ErrConversationLimitReached = errors.New("conversation limit reached")

type ApiError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func (e *ApiError) Error() string {
	return e.Message
}

func New(code int, message string) *ApiError {
	return &ApiError{Code: code, Message: message}
}

func IsApiErr(err error) bool {
	var e *ApiError
	return errors.As(err, &e)
}

func FromError(err error) *ApiError {
	var e *ApiError
	if errors.As(err, &e) {
		return e
	}
	return ErrUnknown
}

var (
	ErrUnknown                        = &ApiError{Code: 10000, Message: "unknown error"}
	ErrInvalidParam                   = &ApiError{Code: 10001, Message: "invalid param"}
	ErrPromptTooLong                  = &ApiError{Code: 10002, Message: "prompt too long"}
	ErrAiChat                         = &ApiError{Code: 10003, Message: "ai chat error"}
	ErrContentHandle                  = &ApiError{Code: 10004, Message: "content handle error"}
	ErrConversationNotFound           = &ApiError{Code: 10005, Message: "conversation not found"}
	ErrMaxTokenExceed                 = &ApiError{Code: 10006, Message: "max token exceed"}
	ErrMaxInputCharactersExceed       = &ApiError{Code: 10007, Message: "max input characters exceed"}
	ErrDiskVolumeExceed               = &ApiError{Code: 10008, Message: "disk volume exceed"}
	ErrImportFileMaxChildrenExceed    = &ApiError{Code: 10009, Message: "import file failed, max children exceed"}
	ErrImportFile                     = &ApiError{Code: 10010, Message: "import file failed"}
	ErrTargetFolderNotFoundOrNoPerm   = &ApiError{Code: 10011, Message: "target folder not found or no permission"}
	ErrRegenMessageNotFound           = &ApiError{Code: 10012, Message: "regen message not found"}
	ErrPackageTypeUnsupported         = &ApiError{Code: 10013, Message: "package type unsupported"}
	ErrUserSeatPptPermissionDenied    = &ApiError{Code: 10014, Message: "user seat ppt permission denied"}
	ErrUserSeatNewDocPermissionDenied = &ApiError{Code: 10015, Message: "user seat new doc permission denied"}
)
