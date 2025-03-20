import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp, Copy, Send, Square, RefreshCcw, Info } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useParams } from "react-router-dom"
import avatar from "@/assets/avatar.png"
import { useIntl } from "react-intl"
import { useFiles } from "@/providers/FileContext"
import { useToast } from "@/components/ui/use-toast"
import * as pdfjsLib from 'pdfjs-dist'
import Robot from "@/assets/robot.png"
import { useChat } from '@ai-sdk/react';

const workerPath = `${import.meta.env.BASE_URL}pdf.worker.js`;

pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;

export default function DocumentChat() {
  const { formatMessage: f } = useIntl()
  const { id: documentId = "" } = useParams()
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState("")
  const { getPreviewUrl, createFileChat, getServerUrl } = useFiles()
  const [conversationId, setConversationId] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  const [showHint, setShowHint] = useState(true)

  const [serverUrl, setServerUrl] = useState("")

  const [currentInput, setCurrentInput] = useState("")

  // 添加新的状态来跟踪每条消息的状态
  const [messageStates, setMessageStates] = useState<{
    [key: string]: {
      isLoading?: boolean;
      isError?: boolean;
      isStopped?: boolean;
    };
  }>({});

  const [collapsedReasonings, setCollapsedReasonings] = useState<{ [key: string]: boolean }>({});

  const toggleReasoning = (index: string) => {
    setCollapsedReasonings(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const { messages, input, setInput, handleInputChange, handleSubmit, stop, status, reload, error } = useChat({
    initialInput: f({ id: "chat.summary" }),
    // api: `${serverUrl}/api/chat/${conversationId}/chat`,
    api: `${serverUrl}/api/chatv2/${conversationId}/chat`,
  });


  useEffect(() => {
    getServerUrl().then(result => {
      setServerUrl(result)
    })
  }, [])

  useEffect(() => {
    if (error) {
      console.log("error", error)
      console.log("messages", messages)
      const lastMessage = messages[messages.length - 1];
      setMessageStates(prev => ({
        ...prev,
        [lastMessage.id]: { isError: true }
      }));
    }
  }, [messages, error])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    // 添加状态避免初始化时创建两次聊天
    let isSubscribed = true;
    async function initChat() {
      setPreviewUrl("")
      if (!documentId) return;
      if (!isSubscribed) return;
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
    initChat();

    return () => {
      isSubscribed = false;
    };
  }, [documentId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
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

  const handleCopy = (content: string) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    const formattedText = tempDiv.innerText;
    navigator.clipboard.writeText(formattedText);
    toast({
      title: f({ id: "common.copy.success" }),
    });
  }

  const handleStop = () => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage) {
      setMessageStates(prev => ({
        ...prev,
        [lastMessage.id]: { isStopped: true }
      }));
    }
    stop();
  }

  // 格式化文本
  const formatMarkdownText = (text: string): string => {
    let formattedText = text

    // 去除最开头的空行
    formattedText = formattedText.replace(/^[\s\n]+/, '')

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
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* {previewUrl} */}
          {previewUrl ? (
            <iframe src={previewUrl} className="w-full h-full" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500">{f({ id: "common.loading" })}</div>
          )}
        </div>

        {/* Right Chat Panel*/}
        <div
          className={`${isChatOpen ? "w-[300px] md:w-[400px]" : "w-0"} transition-all duration-300 relative flex flex-col h-full border-l border-gray-200`}
        >
          {/* 添加提示组件 */}
          {showHint && !isChatOpen && (
            <div
              className="absolute right-20 top-7 bg-white shadow-lg rounded-lg p-3 z-10 animate-bounce
              transition-opacity duration-500 ease-in-out opacity-100 w-[210px]"
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
                  onClick={async () => {
                    await setInput(f({ id: "chat.summary" }));
                    setTimeout(() => {
                      handleSubmit(new Event('submit'), {
                        body: {
                          customKey: "summary"
                        }
                      });
                    }, 0)
                  }}
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
                {messages.map((message, index) => (
                  <div key={message.id}>
                    <div className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}>
                      {message.role === "assistant" && !(messageStates[message.id]?.isStopped || messageStates[message.id]?.isError) && (
                        <img
                          src={avatar || "/placeholder.svg"}
                          alt="Chat Icon"
                          width={28}
                          height={28}
                          className="object-cover flex-shrink-0 self-start"
                        />
                      )}
                      <div className={`space-y-1 ${message.role === "user" ? "items-end" : ((messageStates[message.id]?.isStopped || messageStates[message.id]?.isError) ? "hidden" : "")} max-w-[calc(100%-40px)]`}>
                        <div
                          className={`rounded-2xl p-3 max-w-full ${message.role === "user"
                            ? "bg-[#364153] text-white overflow-hidden"
                            : "bg-gray-100"
                            }`}
                        >
                          <div className="whitespace-pre-line text-sm max-w-full leading-relaxed">
                            <div className="flex items-center gap-2">
                              <div
                                className="break-words max-w-full"
                              >
                                {message.parts.map((part, index) => {
                                  switch (part.type) {
                                    case 'text':
                                      return <div key={index} dangerouslySetInnerHTML={{ __html: formatMarkdownText(part.text) }}></div>;
                                    case 'reasoning':
                                      return (
                                        <div key={index} className="my-2 text-xs text-[#8b8b8b]">
                                          <div className="text-[#8b8b8b] bg-gray-200 rounded-xl pr-3 pl-3 pt-1 pb-1 flex items-center gap-1 w-23"
                                            onClick={() => toggleReasoning(index.toString())}>
                                            {f({ id: "common.thinking.details" })}{collapsedReasonings[index.toString()] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                          </div>
                                          {!collapsedReasonings[index.toString()] && (
                                            <div>
                                              <pre className="text-xs text-gray-400 p-2 rounded-md overflow-x-auto whitespace-pre-wrap border-l-4 border-gray-400 my-2">
                                                {part.details.map((detail, i) => {
                                                  switch (detail.type) {
                                                    case 'text':
                                                      return (
                                                        <div key={i}>
                                                          {detail.text}
                                                          {detail.signature && (
                                                            <div className="text-xs text-gray-500 mt-1 italic border-t border-gray-200 pt-1">
                                                              {detail.signature}
                                                            </div>
                                                          )}
                                                        </div>
                                                      );
                                                    case 'redacted':
                                                      return <div key={i} className="inline-block">{detail.data}</div>;
                                                    default:
                                                      return null;
                                                  }
                                                })}
                                              </pre>
                                            </div>
                                          )}
                                        </div>
                                      )
                                    case 'source':
                                      return <a key={index} href={part.source.url} target="_blank" className="text-blue-500">{part.source.url}</a>;
                                    default:
                                      return null;
                                  }
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                        {message.role === "assistant" && (
                          <div className="flex items-center gap-1 mt-2">
                            <button className="p-1 hover:bg-gray-100 rounded">
                              <Copy className="w-4 h-4 text-gray-500" onClick={() => handleCopy(message.content)} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* 加载状态 */}
                    {(status === "submitted" && message.role === "user" &&
                      message.id === messages[messages.length - 1].id) && (
                        <div className="flex gap-3 mt-2">
                          <img
                            src={avatar || "/placeholder.svg"}
                            alt="Chat Icon"
                            width={28}
                            height={28}
                            className="object-cover flex-shrink-0 self-start"
                          />
                          <div className="flex gap-1 bg-gray-100 p-3 rounded-2xl">
                            <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0s" }}></span>
                            <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></span>
                            <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></span>
                          </div>
                        </div>
                      )}
                    {/* 错误和中断状态 */}
                    {((messageStates[message.id]?.isError || messageStates[message.id]?.isStopped)) && (
                      <div className="flex gap-3 mt-2">
                        <div className="flex items-center max-w-full">
                          <img
                            src={avatar || "/placeholder.svg"}
                            alt="Chat Icon"
                            width={28}
                            height={28}
                            className="object-cover flex-shrink-0 self-start"
                          />
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2 ml-2 p-3 rounded-2xl bg-[rgba(249,58,55,0.05)] border border-[rgba(249,58,55,0.15)] text-[#f93a37]">
                              <Info className="w-4 h-4 text-[#f93a37]" />
                              {messageStates[message.id]?.isError ? f({ id: "chat.error" }) : f({ id: "chat.retry" })}
                            </div>
                            <div className="flex items-center gap-1 ml-3">
                              <button className="p-1 hover:bg-gray-100 rounded">
                                <Copy className="w-4 h-4 text-gray-500" onClick={() => handleCopy(message.content)} />
                              </button>
                              {
                                index === messages.length - 1 && (
                                  <button
                                    onClick={() => {
                                      reload()
                                      setMessageStates(prev => ({
                                        ...prev,
                                        [message.id]: { isError: false, isStopped: false }
                                      }));
                                    }}
                                    className="text-gray-500 hover:bg-gray-100 rounded-md p-1 text-sm"
                                  >
                                    <RefreshCcw className="w-4 h-4" />
                                  </button>
                                )
                              }
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {isChatOpen && (
            <div className="p-4 border-t border-gray-200">
              <form onSubmit={(e) => handleSubmit(e, {
                body: {
                  customKey: (currentInput == f({ id: "chat.summary" }) || currentInput == "summary") ? "summary" : ""
                }
              })} className="flex gap-2">
                <Input
                  placeholder={f({ id: "chat.placeholder" })}
                  name="prompt"
                  value={input}
                  onChange={(e) => {
                    handleInputChange(e);
                    setCurrentInput(e.target.value)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault()
                      handleSubmit(e, {
                        body: {
                          customKey: (currentInput == f({ id: "chat.summary" }) || currentInput == "summary") ? "summary" : ""
                        }
                      })
                    }
                  }}
                  className="rounded-xl border border-[#677894] bg-white focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <Button
                  type="submit"
                  className={`rounded-xl ${(status == "submitted" || status == "streaming") ? 'bg-[#f93a37]' : 'bg-[#364153]'} text-white`}
                  onClick={() => (status == "submitted" || status == "streaming") && handleStop()}
                  disabled={!(input || status !== "ready")}
                >
                  {status == "submitted" || status == "streaming" ? (
                    <Square className="h-4 w-4" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

