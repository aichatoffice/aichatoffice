package streaming

import (
	"fmt"
	"math/rand"
	"strconv"
	"time"
)

// StreamPartType 定义了Vercel AI SDK流协议中所有支持的部分类型
type StreamPartType string

const (
	// TextPart 文本部分 - 格式: 0:string\n
	TextPart StreamPartType = "0"

	// ReasoningPart 推理部分 - 格式: g:string\n
	ReasoningPart StreamPartType = "g"

	// RedactedReasoningPart 已编辑的推理部分 - 格式: i:{"data": string}\n
	RedactedReasoningPart StreamPartType = "i"

	// ReasoningSignaturePart 推理签名部分 - 格式: j:{"signature": string}\n
	ReasoningSignaturePart StreamPartType = "j"

	// SourcePart 来源部分 - 格式: h:Source\n
	SourcePart StreamPartType = "h"

	// DataPart 数据部分 - 格式: 2:Array<JSONValue>\n
	DataPart StreamPartType = "2"

	// MessageAnnotationPart 消息注释部分 - 格式: 8:Array<JSONValue>\n
	MessageAnnotationPart StreamPartType = "8"

	// ErrorPart 错误部分 - 格式: 3:string\n
	ErrorPart StreamPartType = "3"

	// ToolCallStreamingStartPart 工具调用流式开始部分 - 格式: b:{toolCallId:string; toolName:string}\n
	ToolCallStreamingStartPart StreamPartType = "b"

	// ToolCallDeltaPart 工具调用增量更新部分 - 格式: c:{toolCallId:string; argsTextDelta:string}\n
	ToolCallDeltaPart StreamPartType = "c"

	// ToolCallPart 工具调用部分 - 格式: 9:{toolCallId:string; toolName:string; args:object}\n
	ToolCallPart StreamPartType = "9"

	// ToolResultPart 工具结果部分 - 格式: a:{toolCallId:string; result:object}\n
	ToolResultPart StreamPartType = "a"

	// StartStepPart 步骤开始部分 - 格式: f:{messageId:string}\n
	StartStepPart StreamPartType = "f"

	// FinishStepPart 步骤完成部分 - 格式: e:{finishReason:string; usage:{...}; isContinued:boolean}\n
	FinishStepPart StreamPartType = "e"

	// FinishMessagePart 消息完成部分 - 格式: d:{finishReason:string; usage:{...}}\n
	FinishMessagePart StreamPartType = "d"
)

// FinishReason 定义了流终止的原因
type FinishReason string

const (
	// FinishReasonStop 正常停止
	FinishReasonStop FinishReason = "stop"

	// FinishReasonLength 由于长度限制而停止
	FinishReasonLength FinishReason = "length"

	// FinishReasonContentFilter 由于内容过滤而停止
	FinishReasonContentFilter FinishReason = "content-filter"

	// FinishReasonToolCalls 由于工具调用而停止
	FinishReasonToolCalls FinishReason = "tool-calls"

	// FinishReasonError 由于错误而停止
	FinishReasonError FinishReason = "error"

	// FinishReasonOther 由于其他原因而停止
	FinishReasonOther FinishReason = "other"

	// FinishReasonUnknown 由于未知原因而停止
	FinishReasonUnknown FinishReason = "unknown"
)

func FormatDataContent(data string, dataType StreamPartType) string {
	switch dataType {
	case TextPart:
		quotedData := strconv.Quote(data)
		quotedData = quotedData[1 : len(quotedData)-1]
		return fmt.Sprintf("0:\"%s\"\n", quotedData)
	case ReasoningPart:
		return fmt.Sprintf("g:\"%s\"\n", data)
	case RedactedReasoningPart:
		return fmt.Sprintf("i:{\"data\":\"%s\"}\n", data)
	case ReasoningSignaturePart:
		return fmt.Sprintf("j:%s\n", data)
	case SourcePart:
		return fmt.Sprintf("h:{\"url\":\"%s\"}\n", data)
	case DataPart:
		return fmt.Sprintf("2:%s\n", data)
	case MessageAnnotationPart:
		return fmt.Sprintf("8:%s\n", data)
	case ErrorPart:
		return fmt.Sprintf("3:\"%s\"\n", data)
	case ToolCallStreamingStartPart:
		return fmt.Sprintf("b:%s\n", data)
	case ToolCallDeltaPart:
		return fmt.Sprintf("c:%s\n", data)
	case ToolCallPart:
		return fmt.Sprintf("9:%s\n", data)
	case ToolResultPart:
		return fmt.Sprintf("a:%s\n", data)
	case StartStepPart:
		return fmt.Sprintf("f:%s\n", data)
	case FinishStepPart:
		return fmt.Sprintf("e:%s\n", data)
	case FinishMessagePart:
		return fmt.Sprintf("d:%s\n", data)
	default:
		return ""
	}
}

// -------- 以下测试
func GenTestStreamData(dataType StreamPartType, event chan string) {
	// 单独处理推理签名部分 (需要现有推理数据, 然后生成签名)
	if dataType == ReasoningSignaturePart {
		go func() {
			defer close(event)
			textContent := "This is an AI-generated response with reasoning."
			event <- FormatDataContent(textContent, TextPart)
			time.Sleep(time.Duration(rand.Intn(400)+100) * time.Millisecond)
			reasoningContent := "Analyzing the given problem, considering possible solutions..."
			event <- FormatDataContent(reasoningContent, ReasoningPart)
			time.Sleep(time.Duration(rand.Intn(400)+100) * time.Millisecond)
			signatureContent := `{"signature": "abc123xyz", "model": "gpt-4-turbo", "confidence": 0.98, "verified": true}`
			event <- FormatDataContent(signatureContent, ReasoningSignaturePart)
		}()
		return
	} else if dataType == DataPart {
		// 数据部分 数组一起返回
		go func() {
			defer close(event)
			dataContent := GenTestData(dataType)
			event <- FormatDataContent(dataContent, dataType)
			// 添加一个短暂延迟确保数据被处理
			time.Sleep(100 * time.Millisecond)
		}()
		return
	}

	dataContent := GenTestData(dataType)

	// 把内容分段，每段随机 8-12 个字符，直至内容全部输出
	// 随机等待 100-500ms，输出到 event 中
	go func() {
		defer close(event)
		start := 0
		for start < len(dataContent) {
			n := rand.Intn(5) + 8 // 随机生成8-12个字符的长度
			end := start + n
			if end > len(dataContent) {
				end = len(dataContent)
			}
			finalData := dataContent[start:end]
			event <- FormatDataContent(finalData, dataType)
			start = end
			if start >= len(dataContent) {
				return
			}
			time.Sleep(time.Duration(rand.Intn(400)+100) * time.Millisecond)
		}
	}()
}

// 根据类型生成测试内容，要注意不同的类型，内容格式不同，例如有的要求是 json
func GenTestData(dataType StreamPartType) string {
	switch dataType {
	case TextPart:
		return "Hello World! This is a sample text response that demonstrates streaming capabilities. It contains multiple sentences to show how text can be chunked and delivered progressively to the client."
	case ReasoningPart:
		return "I'm analyzing this problem step by step. First, I need to understand the requirements. Then, I'll consider different approaches and evaluate their trade-offs. This reasoning process helps me arrive at the most effective solution."
	case RedactedReasoningPart:
		return "This part of the reasoning has been redacted for [reason]. The model considered several approaches including [redacted] but determined that [redacted] would be most appropriate."
	case ReasoningSignaturePart:
		return "Reasoning process completed by Model-XYZ v2.1 with confidence score 0.92 and verification status: passed"
	case SourcePart:
		return "https://example.com"
	case DataPart:
		return `[{"id":"item_123","name":"Product A","price":29.99}]`
	case MessageAnnotationPart:
		return `{
  "annotation_id": "ann_123456",
  "type": "citation",
  "text": "According to recent studies...",
  "attributes": {
    "source": "Journal of AI Research",
    "publication_date": "2023-03-15",
    "confidence": 0.95,
    "page_number": 42
  }
}`
	case ErrorPart:
		return "Error code: 503; Message: Service temporarily unavailable; Details: The requested model is currently experiencing high demand. Please retry your request in a few minutes."
	case ToolCallStreamingStartPart:
		return `{
  "tool_call_id": "call_abc123def456",
  "name": "weather_forecast",
  "status": "starting",
  "timestamp": "2023-06-15T14:22:31Z"
}`
	case ToolCallDeltaPart:
		return `{
  "tool_call_id": "call_abc123def456",
  "delta": {
    "content": "partial response with weather data",
    "progress": 0.45,
    "status": "in_progress"
  }
}`
	case ToolCallPart:
		return `{
  "tool_call_id": "call_abc123def456",
  "name": "database_query",
  "arguments": {
    "query": "SELECT * FROM users WHERE active = true",
    "database": "customer_records",
    "limit": 100,
    "offset": 0,
    "order_by": "last_login_date DESC"
  }
}`
	case ToolResultPart:
		return `{
  "tool_call_id": "call_abc123def456",
  "result": {
    "status": "success",
    "execution_time_ms": 328,
    "data": {
      "records": [
        {"id": 1001, "name": "Alice", "email": "alice@example.com"},
        {"id": 1002, "name": "Bob", "email": "bob@example.com"}
      ],
      "metadata": {
        "total_records": 2,
        "query_plan": "index_scan"
      }
    }
  }
}`
	case StartStepPart:
		return `{
  "step_id": "step_xyz789",
  "type": "reasoning",
  "name": "Problem Analysis",
  "description": "Analyzing the user's request to identify key requirements and constraints",
  "timestamp": "2023-06-15T14:22:31Z",
  "estimated_duration_ms": 500
}`
	case FinishStepPart:
		return `{
  "step_id": "step_xyz789",
  "status": "completed",
  "duration_ms": 487,
  "outputs": {
    "identified_requirements": ["data processing", "visualization"],
    "constraints": ["performance", "security"],
    "priority": "high"
  }
}`
	case FinishMessagePart:
		return `{
  "finish_reason": "stop",
  "message_id": "msg_987654321",
  "total_duration_ms": 2345,
  "token_usage": {
    "prompt_tokens": 142,
    "completion_tokens": 567,
    "total_tokens": 709
  },
  "model": "gpt-4-turbo"
}`
	default:
		return ""
	}
}

func GetTypeByText(text string) StreamPartType {
	switch text {
	case "文本":
		return TextPart
	case "推理":
		return ReasoningPart
	case "已编辑的推理":
		return RedactedReasoningPart
	case "推理签名":
		return ReasoningSignaturePart
	case "来源":
		return SourcePart
	case "数据":
		return DataPart
	case "消息注释":
		return MessageAnnotationPart
	case "错误":
		return ErrorPart
	case "工具调用流式开始":
		return ToolCallStreamingStartPart
	case "工具调用增量更新":
		return ToolCallDeltaPart
	case "工具调用":
		return ToolCallPart
	case "工具结果":
		return ToolResultPart
	case "步骤开始":
		return StartStepPart
	case "步骤完成":
		return FinishStepPart
	case "消息完成":
		return FinishMessagePart
	default:
		return TextPart
	}
}
