import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ChevronRight, ChevronLeft, Copy, Send, Square, RefreshCcw, Info } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useParams } from "react-router-dom"
import avatar from "@/assets/avatar.png"
import { useIntl } from "react-intl"
import { useFiles } from "@/providers/FileContext"
import { useToast } from "@/components/ui/use-toast"// ... existing code ...
import * as pdfjsLib from 'pdfjs-dist'
import { PDFDocumentProxy } from 'pdfjs-dist'
import Robot from "@/assets/robot.png"

const workerPath = `${import.meta.env.BASE_URL}pdf.worker.js`;

pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;

interface Message {
  id: number
  role: string
  content: string
}

export default function DocumentChat() {
  const { formatMessage: f } = useIntl()
  const { id: documentId = "" } = useParams()
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState("")
  const { getPreviewUrl, createFileChat, sendFileChatMessage, breakFileChat, getFileById } = useFiles()
  const [conversationId, setConversationId] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [message, setMessage] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isSending, setIsSending] = useState(false)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const { toast } = useToast()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null)
  const [showHint, setShowHint] = useState(true)

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    // 添加状态避免初始化时创建两次聊天
    let isSubscribed = true;
    async function initChat() {
      setMessages([])
      setPreviewUrl("")
      setPdfData(null)
      if (!documentId) return;
      const file = await getFileById(documentId);
      if (!isSubscribed) return;
      if (file.type.includes("pdf")) {
        if (file.content) {
          setPdfData(base64ToUint8Array(file.content))
          await renderPDF(base64ToUint8Array(file.content))
          const id = await createFileChat();
          if (!isSubscribed) return;
          setConversationId(id);
        }
      } else {
        try {
          const url = await getPreviewUrl(documentId);
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
    }
    initChat();

    return () => {
      isSubscribed = false;
    };
  }, [documentId]);

  // 渲染 PDF
  const renderPDF = async (pdfData: Uint8Array) => {
    try {
      // 直接使用 Uint8Array 数据加载 PDF
      const loadingTask = pdfjsLib.getDocument({ data: pdfData })
      const pdf = await loadingTask.promise
      setPdfDoc(pdf)
      setTotalPages(pdf.numPages)
      await renderPage(1, pdf)
    } catch (error) {
      console.error('PDF 加载失败:', error)
    }
  }

  const renderPage = async (pageNum: number, doc: PDFDocumentProxy) => {
    if (!canvasRef.current) return

    const page = await doc.getPage(pageNum)
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')

    const viewport = page.getViewport({ scale: 1.5 })
    canvas.height = viewport.height
    canvas.width = viewport.width

    const renderContext = {
      canvasContext: context!,
      viewport: viewport
    }

    await page.render(renderContext).promise
  }

  // 将 base64 字符串转换为 Uint8Array
  const base64ToUint8Array = (base64: string) => {
    // 移除 base64 字符串中的 data URI 头部（如果有）
    const base64Clean = base64.replace(/^data:.*,/, '')
    // 解码 base64 为二进制字符串
    const binaryString = window.atob(base64Clean)
    // 创建 Uint8Array
    const bytes = new Uint8Array(binaryString.length)
    // 将每个字符的 ASCII 码存入 Uint8Array
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleSendMessage = async (m: string) => {
    if (!m.trim()) return
    setMessage("")
    setIsLoading(true)
    let processingPromise = Promise.resolve(); // 用于确保顺序处理
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
        async (chunk) => {
          setIsLoading(false)
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
              return
            } else if (parsedChunk.content) {
              textToAdd = parsedChunk.content[0].text?.replace(/^[\n]+/, "") || "";
              // 将新文本分割成字符数组
              const chars = textToAdd.split('');

              // 等待前一个处理完成后再处理新的内容
              processingPromise = processingPromise.then(async () => {
                for (const char of chars) {
                  if (controller.signal.aborted) return;
                  accumulatedResponse += char;

                  await new Promise(resolve => {
                    requestAnimationFrame(() => {
                      // 在流式响应过程中也应用格式化
                      const formattedText = formatMarkdownText(accumulatedResponse);
                      setMessages(prev =>
                        prev.map(msg =>
                          msg.id === assistantMessageId
                            ? { ...msg, content: formattedText }
                            : msg
                        )
                      );
                      setTimeout(resolve, 30);
                    });
                  });
                }
              });

              await processingPromise; // 等待当前块处理完成
            }
          } catch (e) { }
        },
        controller.signal
      );
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

  // 添加页面切换函数
  const changePage = async (newPage: number) => {
    if (!pdfDoc || newPage < 1 || newPage > totalPages) return
    setCurrentPage(newPage)
    await renderPage(newPage, pdfDoc)
  }

  // 添加自动隐藏效果
  useEffect(() => {
    if (showHint) {
      const timer = setTimeout(() => {
        setShowHint(false)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [showHint])

  return (
    <div className="flex flex-col h-screen bg-white">
      <div className="flex flex-1 overflow-hidden">
        {/* Main Document View */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* 添加提示组件 */}
          {showHint && !isChatOpen && (
            <div
              className="absolute right-20 top-7 bg-white shadow-lg rounded-lg p-3 z-10 animate-bounce
              transition-opacity duration-500 ease-in-out opacity-100"
              onClick={() => setShowHint(false)}
              style={{
                animation: 'bounce 1s infinite, fadeOut 0.5s ease-in-out 4.5s forwards'
              }}
            >
              <style>{`
                @keyframes fadeOut {
                  from { opacity: 1; }
                  to { opacity: 0; }
                }
              `}</style>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                {f({ id: "chat.hint" })}
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse" />
              </div>
            </div>
          )}
          {/* {previewUrl} */}
          {previewUrl ? (
            <iframe src={previewUrl} className="w-full h-full" />
          ) : pdfData ? (
            <div className="w-full h-full overflow-auto flex flex-col items-center">
              <canvas ref={canvasRef} className="h-[calc(100%-55px)] max-w-full" />
              {totalPages > 0 && (
                <div className="flex items-center gap-2 mt-2 mb-2 text-sm">
                  <Button
                    onClick={() => changePage(currentPage - 1)}
                    disabled={currentPage <= 1}
                    size="sm"
                    className="bg-gray-100 hover:bg-gray-200"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-gray-600">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    onClick={() => changePage(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    size="sm"
                    className="bg-gray-200 hover:bg-gray-300"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500">加载中...</div>
          )}
        </div>

        {/* Right Chat Panel*/}
        <div
          className={`${isChatOpen ? "w-[300px] md:w-[400px]" : "w-0"} transition-all duration-300 relative flex flex-col h-full border-l border-gray-200`}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute -left-18 top-6 bg-black/5 rounded-full hover:bg-black/10 hover:text-white 
            before:content-[''] before:absolute before:top-0 before:left-[-100%] before:w-full before:h-full 
            before:bg-gradient-to-r before:from-transparent before:via-[#677894]/30 before:to-transparent 
            hover:before:left-[100%] before:transition-all before:duration-500 overflow-hidden"
            onClick={() => {
              setIsChatOpen(!isChatOpen)
              setShowHint(false) // 点击时关闭提示
            }}
          >
            <img src={Robot} alt="robot" className={`w-7 h-7 transition-transform  ${isChatOpen ? "rotate-360" : ""}`} />
          </Button>
          <div className={`${isChatOpen ? "opacity-100" : "opacity-0"} transition-opacity flex-1 p-4 overflow-auto`}>
            {messages.length === 0 ? (
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
                  <div className="w-5 h-5 rounded bg-gray-200 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                        className={`rounded-2xl p-3 max-w-full ${message.role === "user"
                          ? "bg-[#364153] text-white overflow-hidden"
                          : message.content === f({ id: "chat.retry" })
                            ? "bg-[rgba(249,58,55,0.05)] border border-[rgba(249,58,55,0.15)] text-[#f93a37]"
                            : "bg-gray-100"
                          }`}
                      >
                        <div className="whitespace-pre-line text-sm max-w-full leading-relaxed">
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
                  className="rounded-xl border border-[#677894] bg-white focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <Button
                  onClick={isSending ? handleBreakChat : () => handleSendMessage(message)}
                  size="icon"
                  className={`rounded-xl ${isSending ? 'bg-[#f93a37]' : 'bg-[#364153]'} text-white`}
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

