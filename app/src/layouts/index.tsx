import type React from "react"
import "@/index.css"
import {
  Globe,
  MessageSquarePlus,
  FileText,
  ChevronLeft,
  ChevronRight,
  Menu,
  Trash2,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useState, useRef } from "react"
import { useFiles } from "@/providers/FileContext"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
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

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-700 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <MessageSquarePlus className="h-6 w-6 text-white" />
          <Link to="/" className="text-[22px] font-bold text-white">{f({ id: "chatOffice" })}</Link>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="text-white hover:bg-white/10 lg:flex hidden"
        >
          {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <div className="relative">
        <Button
          className="m-4 bg-white text-blue-600 hover:bg-gray-100 transition-all duration-200 transform hover:scale-[1.02] w-[calc(100%-2rem)]"
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
          accept=".pdf,.docx,.doc,.xlsx,.pptx"
        />
      </div>

      <ScrollArea className="flex-1 w-full px-2">
        <div className="py-4 space-y-2 w-full">
          <h3 className="text-sm font-semibold text-gray-400 mb-2 px-2">{f({ id: "recentFiles" })}</h3>
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
                  className={`w-full p-2 rounded-lg hover:bg-white/10 transition-all duration-200 text-left group flex items-center gap-3 ${isActive ? "bg-white/20" : ""}`}
                >
                  <FileText
                    className={`h-5 w-5 flex-shrink-0 ${isActive ? "text-white" : "text-gray-300 group-hover:text-white"} transition-colors`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between max-w-full">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p className={`text-sm truncate max-w-[220px] ${isActive ? "text-white font-medium" : "text-gray-300"}`}>
                              {file.name}
                            </p>
                          </TooltipTrigger>
                          <TooltipContent className="bg-gray-900 text-white border-gray-900">
                            <p>{file.name}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <p className="text-xs text-gray-400">{formatDate(file.create_time)}</p>
                  </div>
                  <Trash2
                    className="h-4 w-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-400"
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

      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <Globe className="h-4 w-4" />
          <select
            className="bg-transparent outline-none text-white"
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
  )

  return (
    <div className="flex min-h-screen">
      {/* Desktop Sidebar */}
      <div
        className={`${isSidebarCollapsed ? "w-[40px]" : "w-80"
          } hidden lg:flex flex-col border-r border-gray-700 fixed h-screen bg-[#41464B] transition-all duration-300`}
      >
        {isSidebarCollapsed ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="h-12 w-full rounded-none text-white hover:bg-white/10"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Sidebar />
        )}
      </div>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#41464B] border-b border-gray-700 flex items-center justify-between px-4 z-10">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-white">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[80%] sm:w-[385px] bg-[#41464B] text-white p-0" asChild>
            <Sidebar />
          </SheetContent>
        </Sheet>
        <span className="text-xl font-bold text-white">{f({ id: "chatOffice" })}</span>
        <div className="w-10" />
      </div>

      {/* Main Content */}
      <div
        className={`flex-1 transition-all duration-300 ${isSidebarCollapsed ? "lg:ml-[40px]" : "lg:ml-80"
          } lg:mt-0 mt-16`}
      >
        <Outlet />
      </div>
    </div>
  )
}

export default function ClientLayout({ onLanguageChange, currentLocale }: ClientLayoutProps) {
  return <ClientLayoutContent onLanguageChange={onLanguageChange} currentLocale={currentLocale} />
}

