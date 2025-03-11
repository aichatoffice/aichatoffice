import type React from "react"
import "@/index.css"
import {
  Globe,
  MessageSquarePlus,
  FileText,
  Trash2,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useState, useRef } from "react"
import { useFiles } from "@/providers/FileContext"
import { useLocation, Outlet } from "react-router-dom"
import { Link } from "react-router-dom"
import { formatDate } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useIntl } from "react-intl"
import Collapse from "@/assets/collapse.png"

interface ClientLayoutProps {
  onLanguageChange: (locale: string) => void;
  currentLocale: string;
}

function ClientLayoutContent({ onLanguageChange, currentLocale }: ClientLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const { formatMessage: f } = useIntl()
  const { files, uploadFile, deleteFile, filesLoading } = useFiles()
  const location = useLocation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [locale, setLocale] = useState(currentLocale)

  const handleNewChatClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      uploadFile(file)
    }
  }

  return (
    <div className="flex min-h-screen">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        className={`fixed top-3 ${isSidebarCollapsed ? 'left-8' : 'left-54'} z-50 bg-white hover:bg-gray-200 lg:flex hidden rounded-2xl`}
      >
        <img
          src={Collapse}
          alt="collapse"
          className={`w-4 h-4 transition-transform duration-300 ${isSidebarCollapsed ? 'rotate-180' : ''}`}
        />
      </Button>
      <div className={`${isSidebarCollapsed ? "w-0" : "w-65"} flex-col border-r border-gray-200 fixed h-screen bg-white transition-all duration-300 ease-in-out overflow-hidden`}>
        <div className="relative h-full flex flex-col">

          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center gap-2 mb-8">
              <MessageSquarePlus className="h-6 w-6 text-gray-700" />
              <Link to="/" className="text-xl font-medium text-gray-800">{f({ id: "chatOffice" })}</Link>
            </div>
            <Button
              className="bg-gray-700 hover:bg-gray-800 rounded-xl text-white transition-all duration-200 transform hover:scale-[1.02] w-full"
              size="lg"
              onClick={handleNewChatClick}
            >
              <MessageSquarePlus className="mr-2 h-4 w-4" />
              {f({ id: "newChat" })}
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileSelect}
              accept=".pdf,.docx,.xlsx,.pptx"
            />
          </div>
          {/* Scrollable File List */}
          <ScrollArea className="flex-1  w-full px-2 custom-scrollbar">
            <div className="py-4 space-y-1 w-full">
              <h3 className="text-sm font-semibold text-gray-400 mb-3 mt-1 px-2">{f({ id: "recentFiles" })}</h3>
              {filesLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-300 mt-20" />
                </div>
              ) : (
                files.map((file) => {
                  const isActive = location.pathname === `/chat/${file.id}`
                  return (
                    <Link
                      key={file.id}
                      to={`/chat/${file.id}`}
                      className={`w-full p-2 rounded-2xl hover:bg-gray-100 transition-all duration-200 text-left group flex items-center gap-3 ${isActive ? "bg-gray-100" : ""}`}
                    >
                      <FileText className={`h-5 w-5 flex-shrink-0 ${isActive ? "text-gray-700" : "text-gray-500"} group-hover:text-gray-700 transition-colors`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between max-w-full">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <p className={`text-sm truncate max-w-[165px] text-gray-700 font-medium`}>
                                  {file.name || f({ id: "noTitle" })}
                                </p>
                              </TooltipTrigger>
                              <TooltipContent className="bg-gray-900 text-sm truncate text-white border-gray-900">
                                {file.name || f({ id: "noTitle" })}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <p className="text-xs text-gray-400">{formatDate(file.create_time, locale === 'zh-CN' ? 'zh' : 'en')}</p>
                      </div>
                      <Trash2
                        className="h-4 w-4 flex-shrink-0 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400"
                        onClick={(e) => {
                          e.preventDefault();
                          deleteFile(file.id);
                        }}
                      />
                    </Link>
                  )
                })
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 mt-auto">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Globe className="h-4 w-4" />
              <select
                className="bg-transparent outline-none text-gray-700 cursor-pointer"
                value={locale}
                onChange={(e) => {
                  setLocale(e.target.value)
                  onLanguageChange(e.target.value)
                }}
              >
                <option value="en-US" className="text-black">
                  English
                </option>
                <option value="zh-CN" className="text-black">
                  中文
                </option>
              </select>
            </div>
          </div>
        </div>
      </div >
      {/* Main Content */}
      < div
        className={`flex-1 transition-all duration-300 ease-in-out ${isSidebarCollapsed ? "ml-0" : "ml-66"}`
        }
      >
        <Outlet />
      </div >
    </div>
  )
}

export default function ClientLayout({ onLanguageChange, currentLocale }: ClientLayoutProps) {
  return <ClientLayoutContent onLanguageChange={onLanguageChange} currentLocale={currentLocale} />
}

