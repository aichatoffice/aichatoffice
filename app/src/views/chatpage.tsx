import { useState, useRef, useEffect, RefCallback } from "react"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp, Copy, Send, Square, RefreshCcw, Info, Settings, X, MoveUpIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { useParams } from "react-router-dom"
import { useIntl } from "react-intl"
import { useFiles } from "@/providers/FileContext"
import { useToast } from "@/components/ui/use-toast"
import * as pdfjsLib from 'pdfjs-dist'
import Robot from "@/assets/robot.gif"
import AIAssistant from "@/assets/ai_assistant.png"
import { useChat } from '@ai-sdk/react';
import { getUserInfo, setUserInfo } from "@/utils/electron"
import { Textarea } from "@/components/ui/textarea"
import { createSDK, FileType } from '@officesdk/web';
import { useLanguage } from "@/providers/LanguageContext"
const workerPath = `${import.meta.env.BASE_URL}pdf.worker.js`;

pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;

interface CustomRequestBody {
  customKey?: string;
}

export default function DocumentChat() {
  const { formatMessage: f } = useIntl()
  const { id: documentId = "" } = useParams()
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState("")
  const { getPreviewParams, getServerUrl, getConversation } = useFiles()
  const [conversationId, setConversationId] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  const [showHint, setShowHint] = useState(true)

  const [serverUrl, setServerUrl] = useState("")

  const [currentInput, setCurrentInput] = useState("")

  const [initialMessages, setInitialMessages] = useState([])

  const [currentUserInfo, setCurrentUserInfo] = useState({ freeTimes: 0, id: "" })

  // 添加新的状态来跟踪每条消息的状态
  const [messageStates, setMessageStates] = useState<{
    [key: string]: {
      isLoading?: boolean;
      isError?: boolean;
      isStopped?: boolean;
    };
  }>({});

  const [collapsedReasonings, setCollapsedReasonings] = useState<{ [key: string]: boolean }>({});

  // 添加上下文数量状态
  const [contextCount, setContextCount] = useState(5);

  const toggleReasoning = (index: string) => {
    setCollapsedReasonings(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const { messages, input, setInput, handleInputChange, handleSubmit, stop, status, reload, error } = useChat({
    initialMessages: initialMessages,
    initialInput: f({ id: "chat.summary" }),
    api: `${serverUrl}/api/chat/${conversationId}/chat?userId=${currentUserInfo?.id}`,
    experimental_prepareRequestBody: ({ messages, id, requestBody }) => {
      console.log("requestBody", requestBody)
      return {
        messages: messages.slice(-contextCount),
        id: id,
        customKey: (requestBody as CustomRequestBody)?.customKey
      }
    },
    onResponse: () => {
      debugger
      const info = {
        ...currentUserInfo,
        freeTimes: currentUserInfo?.freeTimes - 1
      }
      setUserInfo(info)
      setCurrentUserInfo(info)
    }
  });

  useEffect(() => {
    getFreeTimes()
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
        const res = await getPreviewParams(documentId);
        if (!isSubscribed) return;
        setEndpoint(res.endpoint)
        setToken(res.token)
        setFileExt(res.file.ext)

        if (res.endpoint) {
          const conversation = await getConversation(documentId);
          if (!isSubscribed) return;
          setConversationId(conversation.conversationId);
          setInitialMessages(conversation.messages);
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

  const getFreeTimes = async () => {
    const userInfo = await getUserInfo()
    console.log("userInfo", userInfo)
    setCurrentUserInfo(userInfo)
  }

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
    if (!text) return ""

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

  const [endpoint, setEndpoint] = useState("")
  const [fileExt, setFileExt] = useState("")
  const [editor, setEditor] = useState<any>(null)
  const [token, setToken] = useState("")
  const { locale } = useLanguage()

  function getFileTypeFromExt(ext: string) {
    switch (ext) {
      case ".doc":
      case ".docx":
        return FileType.Document
      case ".ppt":
      case ".pptx":
        return FileType.Presentation
      case ".xls":
      case ".xlsx":
        return FileType.Spreadsheet
      case ".pdf":
        return FileType.Pdf
      default:
        return 0
    }
  }

  const loadSDK: RefCallback<HTMLElement> = (el) => {
    if (el && endpoint && !editor) {
      (async () => {
        try {
          const sdk = createSDK({
            endpoint,
            fileId: documentId,
            mode: 'preview',
            role: 'viewer',
            lang: locale === 'en-US' ? 'en-US' : 'zh-CN',
            root: el,
            fileType: getFileTypeFromExt(fileExt),
            token,
            settings: {
              menu: {
                custom: [
                  {
                    name: 'test',
                    type: 'button',
                    label: '按钮测试',
                    callback: () => {
                      console.log('按钮测试');
                    },
                  },
                ],
              },
            },
            userQuery: {
              userName: "demo",
              userId: "1"
            }
          });
          const connectedEditor = await sdk.connect();
          setEditor(connectedEditor);
          console.info(connectedEditor);
        } catch (error) {
          console.error('Failed to create SDK:', error);
        }
      })();
    }
  };



  return (
    <div className="flex flex-col h-screen bg-[#EEF2FF] text-sm mt-0">
      <div className="flex flex-1 overflow-hidden">
        {/* Main Document View */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* {previewUrl} */}
          {endpoint ? (
            <div style={{ width: "100%", height: "100vh" }} ref={loadSDK}>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500">{f({ id: "common.loading" })}</div>
          )}
        </div>

        {/* Right Chat Panel*/}
        <div
          className={`${isChatOpen ? "w-[280px] md:w-[310px]" : "w-0"} bg-[#EEF2FF] transition-all duration-300 relative flex flex-col h-full border-l border-gray-200`}
        >
          {/* 添加提示组件 */}
          {showHint && !isChatOpen && (
            <div
              className="absolute right-20 bottom-6 bg-white shadow-lg rounded-lg p-3 z-10 animate-bounce
              transition-opacity duration-500 ease-in-out opacity-100 w-[140px]"
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

          {
            !isChatOpen && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute -left-25 bottom-6 rounded-full w-25 h-12"
                onClick={() => {
                  setIsChatOpen(true)
                  setShowHint(false) // 点击时关闭提示
                }}
              >
                <img src={Robot} alt="robot" className={`w-full h-full`} />
              </Button>
            )
          }

          <div className={`${isChatOpen ? "opacity-100 p-4" : "opacity-0"} transition-opacity flex-1  overflow-auto`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <img src={AIAssistant} alt="robot" className={`w-8 h-8`} />
                <span className="text-[16px]">AI Assisant</span>
              </div>
              <X className="w-5 h-5 bg-gray-200 rounded-full p-1" onClick={() => setIsChatOpen(false)} />
            </div>
            {messages.length === 0 ? (
              <div className="space-y-4 text-sm text-[#41464B] bg-[#7A98F80D] border border-[#FFFFFFCC] rounded-xl p-4">
                <div className="flex gap-3">
                  <div className="space-y-4">
                    <p className="text-sm text-[#41464B]">{f({ id: "chat.assistant" })}</p>
                    {/* <p>{f({ id: "chat.greeting.1" })}</p>
                    <p>{f({ id: "chat.greeting.2" })}</p>
                    <ul className="list-disc pl-4 space-y-2">
                      <li>{f({ id: "chat.greeting.3" })}</li>
                      <li>{f({ id: "chat.greeting.4" })}</li>
                      <li>{f({ id: "chat.greeting.5" })}</li>
                    </ul>
                    <p>{f({ id: "chat.greeting.6" })}</p> */}
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
                  className="flex items-center gap-2 w-full px-3 py-2 hover:bg-[#6b6cff33] transition-colors text-left bg-[#FFFFFFCC] rounded-xl"
                >
                  <span className="text-xl">😊</span>
                  <span> {f({ id: "chat.summary" })}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {messages.map((message, index) => (
                  <div key={message.id}>
                    <div className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}>
                      <div className={`space-y-1 ${message.role === "user" ? "items-end" : ((messageStates[message.id]?.isStopped || messageStates[message.id]?.isError) ? "hidden" : "")} max-w-[calc(100%-40px)]`}>
                        <div
                          className={`rounded-2xl p-3 max-w-full ${message.role === "user"
                            ? "bg-[#6B6CFF33] text-[#41464B] overflow-hidden"
                            : "bg-[#FFFFFF4D] text-[#41464B] border border-[#FFFFFFCC]"
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
                          {message.role === "assistant" && (
                            <div className="flex items-center gap-1 mt-2">
                              <button className="p-1 hover:bg-gray-100 rounded">
                                <Copy className="w-4 h-4 text-gray-500" onClick={() => handleCopy(message.content)} />
                              </button>
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
                    {/* 加载状态 */}
                    {(status === "submitted" && message.role === "user" &&
                      message.id === messages[messages.length - 1].id) && (
                        <div className="flex gap-3 mt-2">
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
                          <div className="flex flex-col gap-2">
                            <div className="flex items-start gap-2 ml-2 p-3 rounded-2xl bg-[rgba(249,58,55,0.05)] border border-[rgba(249,58,55,0.15)] text-[#f93a37]">
                              <Info className="w-4 h-4 text-[#f93a37] mt-1" />
                              {messageStates[message.id]?.isError ? (
                                <div>
                                  {f({ id: "chat.error1" })}
                                  <a href="#/setting" className="text-blue-300">{f({ id: "chat.aiConfig" })}</a>
                                  {f({ id: "chat.error2" })}
                                </div>
                              ) : f({ id: "chat.retry" })}
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
            <div className="p-4 pt-2 ">
              <div className="flex flex-col gap-2">
                {/* 添加上下文选择器 */}

                <form onSubmit={(e) => handleSubmit(e, {
                  body: {
                    customKey: (currentInput == f({ id: "chat.summary" }) || currentInput == "summary") ? "summary" : ""
                  }
                })} className="flex gap-2">
                  <div className="flex-1 bg-white rounded-xl">
                    <Input
                      placeholder={f({ id: "chat.placeholder" })}
                      name="prompt"
                      value={input}
                      disabled={currentUserInfo?.freeTimes <= 0}
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
                      className="inline-block border-none border-[#677894] focus-visible:ring-0 focus-visible:ring-offset-0 h-15"
                    />
                    <div className="px-3 py-1 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-gray-600 ">
                        <Settings className="h-4 w-4 text-gray-500" />
                        <div className="flex items-center gap-2 border border-dashed border-gray-200 rounded-xl px-2 text-xs bg-gray-100">
                          <span className="text-gray-500 text-xs">{f({ id: "chat.context" })}:</span>
                          <Select defaultValue="5" onValueChange={(e) => setContextCount(Number(e))}>
                            <SelectTrigger className="flex-1 border-none focus:shadow-none rounded-xl px-1 py-0 h-6 text-xs focus:outline-none hover:bg-transparent">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="5">5</SelectItem>
                              <SelectItem value="10">10</SelectItem>
                              <SelectItem value="20">15</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {currentUserInfo?.freeTimes <= 0 && (
                          <div className="text-xs text-gray-400 w-40 text-center">{f({ id: "ai.warning" })} <a href="#/setting" className="text-blue-300">Pro</a></div>
                        )}
                      </div>
                      <Button
                        type="submit"
                        size="sm"
                        className={`rounded-full ${(status == "submitted" || status == "streaming") ? 'bg-[#f93a37]' : 'bg-[#F4F5FF]'} text-[#41464B4D]`}
                        onClick={() => (status == "submitted" || status == "streaming") && handleStop()}
                        disabled={!(input || status !== "ready") || currentUserInfo?.freeTimes <= 0}
                      >
                        {status == "submitted" || status == "streaming" ? (
                          <Square className="h-4 w-4" />
                        ) : (
                          <svg width="10" height="12" viewBox="0 0 10 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path fill-rule="evenodd" clip-rule="evenodd" d="M4.55117 1.14624C4.8036 0.909586 5.19641 0.909586 5.44884 1.14624L8.94884 4.42749C9.21325 4.67538 9.22665 5.09067 8.97876 5.35509C8.73088 5.6195 8.31558 5.63289 8.05117 5.38501L5.65625 3.13978L5.65625 10.375C5.65625 10.7374 5.36244 11.0312 5 11.0312C4.63757 11.0312 4.34375 10.7374 4.34375 10.375L4.34375 3.13978L1.94884 5.38501C1.68443 5.63289 1.26913 5.6195 1.02124 5.35509C0.773358 5.09068 0.786755 4.67538 1.05117 4.42749L4.55117 1.14624Z" fill="#41464B" fill-opacity="0.3" />
                          </svg>
                        )}
                      </Button>
                    </div>
                  </div>


                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

