import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ChevronRight, Copy, Send, Square, RefreshCcw, Info } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useParams } from "react-router-dom"
import avatar from "@/assets/avatar.png"
import { useIntl } from "react-intl"
import { useFiles } from "@/providers/FileContext"
import { useToast } from "@/components/ui/use-toast"

interface Message {
  id: number
  role: string
  content: string
}

export default function DocumentChat() {
  const { formatMessage: f } = useIntl()
  const { id: documentId = "" } = useParams()
  const [isChatOpen, setIsChatOpen] = useState(true)
  const [previewUrl, setPreviewUrl] = useState("")
  const { getPreviewUrl, createFileChat, sendFileChatMessage, breakFileChat } = useFiles()
  const [conversationId, setConversationId] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const defaultMessages = [
    {
      id: Date.now(),
      role: "assistant",
      content:
        f({ id: "chat.greeting.1" }) +
        "\n\n" +
        f({ id: "chat.greeting.2" }) +
        "\n\n" +
        f({ id: "chat.greeting.3" }) +
        "\n\n" +
        f({ id: "chat.greeting.4" }) +
        "\n\n" +
        f({ id: "chat.greeting.5" }) +
        "\n\n" +
        f({ id: "chat.greeting.6" }),
    },
  ]
  const [messages, setMessages] = useState<Message[]>(defaultMessages)
  const [message, setMessage] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isSending, setIsSending] = useState(false)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    // 添加状态避免初始化时创建两次聊天
    let isSubscribed = true;
    async function initChat() {
      setMessages(defaultMessages)
      if (!documentId) return;
      try {
        const url = await getPreviewUrl(documentId || "case_word.docx");
        if (!isSubscribed) return;
        setPreviewUrl(url || "");

        if (url) {
          const id = await createFileChat();
          if (!isSubscribed) return;
          setConversationId(id);
        }
      } catch (error) {
        console.error('初始化聊天失败:', error);
      }
    }
    initChat();

    return () => {
      isSubscribed = false;
    };
  }, [documentId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleSendMessage = async (m: string) => {
    if (!m.trim()) return
    setMessage("")
    setIsLoading(true)
    const controller = new AbortController()
    setAbortController(controller)

    // 添加用户消息
    const userMessage = {
      id: Date.now(),
      role: "user",
      content: m,
    }
    setMessages((prev) => [...prev, userMessage as Message])
    // 添加对话消息
    const assistantMessageId = Date.now() + 1
    setMessages((prev) => [
      ...prev,
      {
        id: assistantMessageId,
        role: "assistant",
        content: "",
      },
    ])

    let accumulatedResponse = "" // 存放完整的响应数据

    try {
      setIsSending(true)
      await sendFileChatMessage(
        conversationId,
        {
          stream: true,
          content: [{ type: "text", text: m }],
        },
        (chunk) => {
          if (controller.signal.aborted) return

          let textToAdd = chunk
          try {
            const parsedChunk = JSON.parse(chunk)
            if (parsedChunk.type === "error") {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: f({ id: "chat.retry" }) }
                    : msg
                )
              )
              setIsSending(false)
              setIsLoading(false)
              return
            } else if (parsedChunk.content) {
              textToAdd = parsedChunk.content[0].text?.replace(/^[\n]+/, "") || "";
            }
          } catch (e) { }

          // 确保消息内容被完整添加
          accumulatedResponse += textToAdd
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId ? { ...msg, content: accumulatedResponse } : msg
            )
          )
        },
        controller.signal
      );

      // 确保在流结束后再次更新最终的消息
      if (accumulatedResponse) {
        const formattedResponse = formatMarkdownText(accumulatedResponse);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId ? { ...msg, content: formattedResponse } : msg
          )
        );
      }
    } catch (error: unknown) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId
            ? {
              ...m,
              content: f({ id: "chat.retry" }),
            }
            : m
        )
      )
    } finally {
      setIsSending(false)
      setIsLoading(false)
      setAbortController(null)
    }
  }

  const handleBreakChat = async () => {
    if (abortController) {
      abortController.abort()
      setIsSending(false)
      await breakFileChat(conversationId)
      // 更新最后一条助手消息
      setMessages((prev) =>
        prev.map((m, index) =>
          index === prev.length - 1 && m.role === "assistant"
            ? { ...m, content: f({ id: "chat.retry" }) }
            : m
        )
      )
    }
  }

  const handleRetry = async (messageContent: string) => {
    // 移除最后两条消息（用户的问题和助手的错误响应）
    setMessages(prev => prev.slice(0, -2));
    // 重新发送消息
    await handleSendMessage(messageContent);
  }

  // 添加新的工具函数
  const formatMarkdownText = (text: string): string => {
    let formattedText = text

    // 处理数学公式部分保持不变
    formattedText = formattedText
      .replace(/\\\[([\s\S]*?)\\\]/g, '<div class="math-block">$1</div>')
      .replace(/\\\((.*?)\\\)/g, '<span class="math-inline">$1</span>')

    // 改进粗体处理逻辑，使用非贪婪匹配并处理嵌套情况
    formattedText = formattedText
      .replace(/\*\*((?:[^*]|\*(?!\*))+?)\*\*/g, '<strong>$1</strong>')  // 处理所有 **文本** 格式
      .replace(/\*([^*]+?)\*/g, '<em>$1</em>')             // 处理斜体
      .replace(/_([^_]+?)_/g, '<em>$1</em>')               // 处理下划线斜体

    // 处理缩进和空格
    formattedText = formattedText
      .replace(/&nbsp;/g, ' ')
      .replace(/^\s{2,}/gm, match => match.replace(/ /g, '&nbsp;'))

    // 处理标题格式
    formattedText = formattedText.replace(/^(#{1,6})\s+(.+)$/gm, '<h$1>$2</h$1>')

    // 处理代码块和行内代码
    formattedText = formattedText
      .replace(/```(\w*)\n([\s\S]*?)\n```/g, '<pre><code class="language-$1">$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')

    // 处理列表
    formattedText = formattedText.replace(/^(\s*[-*]\s)/gm, match => match.replace(/ /g, '&nbsp;'))

    // 处理链接
    formattedText = formattedText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')

    // 处理换行，但保留数学公式块的换行
    formattedText = formattedText.replace(/(?<!<div class="math-block">[\s\S]*)\n(?![\s\S]*<\/div>)/g, '<br>')

    return formattedText
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      <div className="flex flex-1 overflow-hidden">
        {/* Main Document View */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* {previewUrl} */}
          {previewUrl ? (
            <iframe src={previewUrl} className="w-full h-full" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500">加载中...</div>
          )}
        </div>

        {/* Right Chat Panel*/}
        <div
          className={`${isChatOpen ? "w-[300px] md:w-[400px]" : "w-0"} transition-all duration-300 relative flex flex-col h-full`}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute -left-12 top-2 bg-black/20 hover:bg-black/40 hover:text-white"
            onClick={() => setIsChatOpen(!isChatOpen)}
          >
            <ChevronRight className={`h-4 w-4 transition-transform ${isChatOpen ? "rotate-180" : ""}`} />
          </Button>
          <div className={`${isChatOpen ? "opacity-100" : "opacity-0"} transition-opacity flex-1 p-4 overflow-auto`}>
            {messages.length === 1 ? (
              <div className="space-y-4 text-sm">
                <div className="flex gap-3">
                  <img
                    src={avatar || "/placeholder.svg"}
                    alt="Chat Icon"
                    width={28}
                    height={28}
                    className="object-cover flex-shrink-0 self-start"
                  />
                  <div className="space-y-4">
                    <p>{f({ id: "chat.greeting.1" })}</p>
                    <p>{f({ id: "chat.greeting.2" })}</p>
                    <ul className="list-disc pl-4 space-y-2">
                      <li>{f({ id: "chat.greeting.3" })}</li>
                      <li>{f({ id: "chat.greeting.4" })}</li>
                      <li>{f({ id: "chat.greeting.5" })}</li>
                    </ul>
                    <p>{f({ id: "chat.greeting.6" })}</p>
                  </div>
                </div>

                <button
                  onClick={() => handleSendMessage(f({ id: "chat.summary" }))}
                  className="flex items-center gap-2 w-full p-3 rounded-lg hover:bg-gray-100 transition-colors text-left"
                >
                  <div className="w-5 h-5 rounded bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                    </svg>
                  </div>
                  <span>{f({ id: "chat.summary" })}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((message) => (
                  <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}>
                    {message.role === "assistant" && (
                      <img
                        src={avatar || "/placeholder.svg"}
                        alt="Chat Icon"
                        width={28}
                        height={28}
                        className="object-cover flex-shrink-0 self-start"
                      />
                    )}
                    <div className={`space-y-1 ${message.role === "user" ? "items-end" : ""} max-w-[calc(100%-40px)]`}>
                      <div
                        className={`rounded-lg p-3 max-w-full ${message.role === "user"
                          ? "bg-blue-600 text-white"
                          : message.content === f({ id: "chat.retry" })
                            ? "bg-[rgba(249,58,55,0.05)] border border-[rgba(249,58,55,0.15)] text-[#f93a37]"
                            : "bg-gray-100"
                          }`}
                      >
                        <div className="whitespace-pre-line text-sm max-w-full">
                          {(isLoading && message.role === "assistant" && message.id === messages[messages.length - 1].id) ? (
                            <div className="flex gap-1">
                              <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0s" }}></span>
                              <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></span>
                              <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              {message.content === f({ id: "chat.retry" }) && (
                                <Info className="w-4 h-4 text-[#f93a37]" />
                              )}
                              <div
                                className="break-words max-w-full"
                                dangerouslySetInnerHTML={{
                                  __html: message.content || ""
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                      {message.role === "assistant" && (
                        <div className="flex items-center gap-1 mt-2">
                          <button className="p-1 hover:bg-gray-100 rounded">
                            <Copy className="w-4 h-4 text-gray-500" onClick={() => {
                              // 创建临时div来解析HTML
                              const tempDiv = document.createElement('div');
                              tempDiv.innerHTML = message.content;
                              // 获取格式化后的文本
                              const formattedText = tempDiv.innerText;
                              navigator.clipboard.writeText(formattedText);
                              toast({
                                title: f({ id: "common.copy.success" }),
                              });
                            }} />
                          </button>
                          {(message.content === f({ id: "chat.retry" }) &&
                            message.id === messages[messages.length - 1].id) && (
                              <button
                                onClick={() => {
                                  // 找到上一条用户消息
                                  const prevUserMessage = messages
                                    .slice(0, messages.findIndex(m => m.id === message.id))
                                    .reverse()
                                    .find(m => m.role === "user");
                                  if (prevUserMessage) {
                                    handleRetry(prevUserMessage.content);
                                  }
                                }}
                                className="text-gray-500 hover:bg-gray-100 rounded-md p-1 text-sm "
                              >
                                <RefreshCcw className="w-4 h-4" />
                              </button>
                            )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {isChatOpen && (
            <div className="p-4 border-t border-gray-200">
              <div className="flex gap-2">
                <Input
                  placeholder={f({ id: "chat.placeholder" })}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={isSending || isLoading}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault()
                      handleSendMessage(message)
                    }
                  }}
                />
                <Button
                  onClick={isSending ? handleBreakChat : () => handleSendMessage(message)}
                  size="icon"
                  className={`${isSending ? 'bg-[#f93a37]' : 'bg-blue-500'} text-white`}
                  disabled={!isSending && message.length === 0}
                >
                  {isSending ? (
                    <Square className="h-4 w-4" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

