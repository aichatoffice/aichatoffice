import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ChevronRight, Copy, ThumbsUp, ThumbsDown, Volume2, Settings2, Send } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useParams } from "react-router-dom"
import avatar from "@/assets/avatar.png"
import { useIntl } from "react-intl"
import { useFiles } from "@/providers/FileContext"
interface Message {
  id: number
  role: "assistant" | "user"
  content: string
}
export default function DocumentChat() {
  const { formatMessage: f } = useIntl()
  const { id: documentId = '' } = useParams()
  const [isChatOpen, setIsChatOpen] = useState(true)
  const [previewUrl, setPreviewUrl] = useState("")
  const { getPreviewUrl } = useFiles()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: Date.now(),
      role: "assistant",
      content:
        f({ id: "chat.greeting.1" }) + "\n\n" +
        f({ id: "chat.greeting.2" }) + "\n\n" +
        f({ id: "chat.greeting.3" }) + "\n\n" +
        f({ id: "chat.greeting.4" }) + "\n\n" +
        f({ id: "chat.greeting.5" }) + "\n\n" +
        f({ id: "chat.greeting.6" }),

    }
  ])
  const [message, setMessage] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    getPreviewUrl(documentId || "case_word.docx").then((url) => {
      setPreviewUrl(url || "")
    })
  }, [documentId, getPreviewUrl])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleSendMessage = () => {
    const newMessages: Message[] = messages.concat([
      {
        id: Date.now(),
        role: "user",
        content: message,
      },
      {
        id: Date.now() + 1,
        role: "assistant",
        content: f({ id: "chat.summary.2" }),
      },
    ])
    setMessages(newMessages)
    setMessage("")
  }

  const handleSummarize = () => {
    const newMessages: Message[] = messages.concat([
      {
        id: Date.now() + 1,
        role: "user",
        content: f({ id: "chat.summary" }),
      },
      {
        id: Date.now() + 2,
        role: "assistant",
        content: f({ id: "chat.summary.1" }),
      },
    ])
    setMessages(newMessages)
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
            <div className="w-full h-full flex items-center justify-center text-gray-500">
              加载中...
            </div>
          )}
        </div>

        {/* Right Chat Panel*/}
        <div
          className={`${isChatOpen ? "w-[300px] md:w-[400px]" : "w-0"} transition-all duration-300 relative flex flex-col h-full`}>
          <Button
            variant="ghost"
            size="icon"
            className="absolute -left-12 top-2 hover:bg-black/40 hover:text-white"
            onClick={() => setIsChatOpen(!isChatOpen)}
          >
            <ChevronRight className={`h-4 w-4 transition-transform ${isChatOpen ? "rotate-180" : ""}`} />
          </Button>
          <div className={`${isChatOpen ? "opacity-100" : "opacity-0"} transition-opacity flex-1 p-4 overflow-auto`}>
            {messages.length === 1 ? (
              <div className="space-y-4 text-sm">
                <div className="flex gap-3">
                  <img
                    src={avatar}
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
                  onClick={handleSummarize}
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
                    {message.role === "assistant" && <img
                      src={avatar}
                      alt="Chat Icon"
                      width={28}
                      height={28}
                      className="object-cover flex-shrink-0 self-start"
                    />}
                    <div className={`space-y-1 ${message.role === "user" ? "items-end" : ""}`}>
                      <div
                        className={`rounded-lg p-3 ${message.role === "user" ? "bg-blue-600 text-white" : "bg-gray-100"
                          }`}
                      >
                        <div className="whitespace-pre-line text-sm">{message.content}</div>
                      </div>
                      {message.role === "assistant" && (
                        <div className="flex items-center gap-2 mt-2">
                          <button className="p-1 hover:bg-gray-100 rounded">
                            <Copy className="w-4 h-4 text-gray-500" />
                          </button>
                          <button className="p-1 hover:bg-gray-100 rounded">
                            <ThumbsUp className="w-4 h-4 text-gray-500" />
                          </button>
                          <button className="p-1 hover:bg-gray-100 rounded">
                            <ThumbsDown className="w-4 h-4 text-gray-500" />
                          </button>
                          <button className="p-1 hover:bg-gray-100 rounded">
                            <Volume2 className="w-4 h-4 text-gray-500" />
                          </button>
                          <button className="p-1 hover:bg-gray-100 rounded">
                            <Settings2 className="w-4 h-4 text-gray-500" />
                          </button>
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
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                />
                <Button onClick={handleSendMessage} size="icon" className="bg-blue-500 text-white" disabled={message.length === 0}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

