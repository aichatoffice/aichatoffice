package aisvc

// func CompletionsTest(ctx *gin.Context) {
// 	ctx.Writer.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
// 	ctx.Writer.Header().Set("Cache-Control", "no-cache")
// 	ctx.Writer.Header().Set("Connection", "keep-alive")
// 	ctx.Writer.Header().Set("Transfer-Encoding", "chunked")
// 	ctx.Writer.Header().Set("x-vercel-ai-data-stream", "v1")

// 	chatRequest := ChatRequest{}
// 	err := ctx.ShouldBindJSON(&chatRequest)
// 	if err != nil {
// 		elog.Error("should bind json", zap.Error(err))
// 		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
// 		return
// 	}

// 	// 最后一条里的content，作为输入内容
// 	// todo 把这个改成一个方法，纳入 customKey 处理
// 	content := chatRequest.Messages[len(chatRequest.Messages)-1].Content
// 	dataType := streaming.GetTypeByText(content)

// 	event := make(chan string)

// 	streaming.GenTestStreamData(dataType, event)

// 	ctx.Stream(func(w io.Writer) bool {
// 		e, ok := <-event
// 		if !ok {
// 			return false
// 		}
// 		elog.Info("chat event", zap.String("event", e))
// 		ctx.Writer.WriteString(e)
// 		w.(http.Flusher).Flush()

// 		return true
// 	})
// }
