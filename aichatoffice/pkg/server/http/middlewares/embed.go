package middlewares

import (
	"embed"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"path"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gotomicro/ego/core/econf"
)

const INDEX = "index.html"

type ServeFileSystem interface {
	http.FileSystem
	Exists(prefix string, path string) bool
}
type localFileSystem struct {
	http.FileSystem
	root    string
	indexes bool
}

func LocalFile(root string, indexes bool) *localFileSystem {
	return &localFileSystem{
		FileSystem: gin.Dir(root, indexes),
		root:       root,
		indexes:    indexes,
	}
}
func (l *localFileSystem) Exists(prefix string, filepath string) bool {
	if p := strings.TrimPrefix(filepath, prefix); len(p) < len(filepath) {
		name := path.Join(l.root, p)
		stats, err := os.Stat(name)
		if err != nil {
			return false
		}
		if stats.IsDir() {
			if !l.indexes {
				index := path.Join(name, INDEX)
				_, err := os.Stat(index)
				if err != nil {
					return false
				}
			}
		}
		return true
	}
	return false
}
func ServeRoot(urlPrefix, root string) gin.HandlerFunc {
	return Serve(urlPrefix, LocalFile(root, false), false)
}

// Static returns a middleware handler that serves static files in the given directory.
func Serve(urlPrefix string, fs ServeFileSystem, isFail bool) gin.HandlerFunc {
	fileserver := http.FileServer(fs)

	if urlPrefix != "" {
		fileserver = http.StripPrefix(urlPrefix, fileserver)
	}
	return func(c *gin.Context) {
		if fs.Exists(urlPrefix, c.Request.URL.Path) {
			if isFail {
				if strings.HasPrefix(c.Request.URL.Path, "/api") || strings.HasPrefix(c.Request.URL.Path, "/callback") {
					c.JSON(http.StatusNotFound, nil)
				} else {
					maxAge := econf.GetInt("server.demo.http.maxAge")
					if maxAge == 0 {
						maxAge = 31536000
					}

					c.Header("Cache-Control", fmt.Sprintf("public, max-age=%d, public", maxAge))
					c.Header("Expires", time.Now().AddDate(1, 0, 0).Format("Mon, 01 Jan 2006 00:00:00 GMT"))
					fileserver.ServeHTTP(c.Writer, c.Request)
				}
			} else {
				fileserver.ServeHTTP(c.Writer, c.Request)
				c.Abort()
			}
		}
	}
}

type embedFileSystem struct {
	http.FileSystem
}

func (e embedFileSystem) Exists(prefix string, path string) bool {
	_, err := e.Open(path)
	if err != nil {
		return false
	}
	return true
}

func EmbedFolder(fsEmbed embed.FS, targetPath string) ServeFileSystem {
	fsys, err := fs.Sub(fsEmbed, targetPath)
	if err != nil {
		panic(err)
	}
	return embedFileSystem{
		FileSystem: http.FS(fsys),
	}
}

type FallbackSystem struct {
	embedFileSystem ServeFileSystem
}

func FallbackFileSystem(embedFileSystem ServeFileSystem) FallbackSystem {
	return FallbackSystem{
		embedFileSystem: embedFileSystem,
	}
}

func (f FallbackSystem) Open(path string) (http.File, error) {
	return f.embedFileSystem.Open("/index.html")
	// ff, err := f.embedFileSystem.Open("/index.html")
	// if err != nil {
	//	return ff, err
	// }
	// rr, _err := os.ReadFile("ui/dist/index.html")
	// if _err != nil {
	//	return ff, err
	// }
	// return &customFile{
	//	embedFile: ff,
	//	contentGetter: func() ([]byte, error) {
	//		// 读取修改后磁盘文件信息
	//		return rr, _err
	//	},
	// }, err
}

func (f FallbackSystem) Exists(prefix string, path string) bool {
	return true
}

// 重新定义 http.File 中 Read逻辑
type customFile struct {
	embedFile     http.File
	contentGetter func() ([]byte, error)
}

func (f *customFile) Read(p []byte) (n int, err error) {
	content, err := f.contentGetter()
	if err != nil {
		return 0, err
	}
	n = copy(p, content)
	return n, nil
}

func (f *customFile) Seek(offset int64, whence int) (int64, error) {
	return f.embedFile.Seek(offset, whence)
}

func (f *customFile) Close() error {
	return f.embedFile.Close()
}

func (f *customFile) Readdir(count int) ([]os.FileInfo, error) {
	return f.embedFile.Readdir(count)
}

func (f *customFile) Stat() (os.FileInfo, error) {
	return f.embedFile.Stat()
}
