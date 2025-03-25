package utils

import (
	"bytes"
	"io"
)

type TeeWriter struct {
	writer io.Writer
	buffer *bytes.Buffer
}

func NewTeeWriter(w io.Writer) *TeeWriter {
	return &TeeWriter{
		writer: w,
		buffer: &bytes.Buffer{},
	}
}

func (t *TeeWriter) Write(p []byte) (n int, err error) {
	n, err = t.writer.Write(p)
	if err != nil {
		return n, err
	}
	return t.buffer.Write(p)
}

func (t *TeeWriter) GetBuffer() *bytes.Buffer {
	return t.buffer
}

type ChanWriter struct {
	ch chan<- string
}

func NewChanWriter(ch chan<- string) *ChanWriter {
	return &ChanWriter{ch: ch}
}

func (w *ChanWriter) Write(p []byte) (n int, err error) {
	w.ch <- string(p)
	return len(p), nil
}
