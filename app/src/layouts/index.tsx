import type React from "react"
import "@/index.css"
import {
  Globe,
  MessageSquarePlus,
  FileText,
  Trash2,
  Loader2,
  Settings as SettingsIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useState, useRef, useEffect } from "react"
import { useFiles } from "@/providers/FileContext"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import Collapse from "@/assets/icon/collapse.png"
import Chat from "@/assets/icon/chat.png"
import ppt from "@/assets/file/ppt.png"
import word from "@/assets/file/word.png"
import excel from "@/assets/file/excel.png"
import pdf from "@/assets/file/pdf.png"
import Logo from "@/assets/logo.png"
import avatar from "@/assets/icon/avatar.png"
import { useNavigate } from "react-router-dom"
import { isElectron, getUserInfo } from "@/utils/electron"
import SettingsDialog from "@/views/settings/settings"
import { useLanguage } from "@/providers/LanguageContext"

function ClientLayoutContent() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { formatMessage: f } = useIntl()
  const { files, uploadFile, deleteFile, filesLoading } = useFiles()
  const location = useLocation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { locale } = useLanguage()
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const checkUserInfo = async () => {
      let userInfo = null
      if (isElectron()) {
        // 在 Electron 环境中从 electron-store 获取用户信息
        try {
          userInfo = await getUserInfo()
          if (!userInfo) {
            throw new Error('用户信息获取失败');
          }
        } catch (error) {
          console.error('获取用户信息失败:', error)
        }
      } else {
        // 在浏览器环境中从 localStorage 获取用户信息
        userInfo = localStorage.getItem('user')
      }
      console.log(userInfo, 'userInfo');
      if (!userInfo) {
        navigate('/login')
      } else {
        setUser(JSON.parse(userInfo))
        navigate('/')
      }
    }

    checkUserInfo()
  }, [navigate])

  const handleNewChatClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      uploadFile(file)
    }
  }

  const getFileIcon = (name: string) => {
    switch (name.substring(name.lastIndexOf('.') + 1)) {
      case "doc":
      case "docx":
        return word
      case "ppt":
      case "pptx":
        return ppt
      case "xls":
      case "xlsx":
        return excel
      case "pdf":
        return pdf
    }
  }

  return (
    <div className="flex min-h-screen">
      {isElectron() && (
        <div className="fixed top-0 left-0 right-0 h-8 flex items-center justify-between px-4 z-50" id="title-bar">
        </div>
      )}
      <div className={`${isSidebarCollapsed ? "w-16" : "w-62"} flex-col fixed h-screen bg-white transition-all duration-300 ease-in-out overflow-hidden`}>
        <div className={`relative flex flex-col ${isElectron() ? 'mt-4 h-[calc(100vh-18px)]' : 'h-full'} bg`}>
          {/* Header */}
          <div className={`m-2 mb-0 p-2 pb-4 border-b border-color ${isSidebarCollapsed ? 'flex flex-col items-center' : ''}`}>
            <div className={`flex items-center gap-2 mb-${isSidebarCollapsed ? '2' : '4'} ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
              <div className="flex items-center gap-2">
                <img src={Logo} alt="logo" className="w-8 h-8 mr-2" />
                {!isSidebarCollapsed && <Link to="/" className="text-[18px] font-medium text-gray-800">{f({ id: "chatOffice" })}</Link>}
              </div>
              {!isSidebarCollapsed && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                  className="hover:bg-[#6B6CFF1A] rounded-full"
                >
                  <img
                    src={Collapse}
                    alt="collapse"
                    className="w-7 h-7 transition-transform duration-300"
                  />
                </Button>
              )}
            </div>
            {isSidebarCollapsed && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="w-full mb-2 hover:bg-[#6B6CFF1A] rounded-full"
              >
                <img
                  src={Collapse}
                  alt="collapse"
                  className="w-7 h-7 transition-transform duration-300 rotate-180"
                />
              </Button>
            )}
            <Button
              className={`transition-all duration-200 transform hover:scale-[1.02] ${isSidebarCollapsed ? 'w-10 px-0' : 'w-full'} text-[14px]`}
              size="lg"
              onClick={handleNewChatClick}
            >
              <img src={Chat} alt="chat" className="h-[21px]" />
              {!isSidebarCollapsed && f({ id: "newChat" })}
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
          {
            !isSidebarCollapsed && (
              <ScrollArea className="flex-1 w-full px-2 custom-scrollbar">
                <div className="py-4 space-y-1 w-full">
                  {!isSidebarCollapsed && <h3 className="text-sm text-[#41464B99] mb-2 px-2 text-[14px]">{f({ id: "recentFiles" })}</h3>}
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
                          className={`w-full p-2 rounded-2xl hover:bg-[#6B6CFF33] transition-all duration-200 text-left group flex items-center gap-3 ${isActive ? "bg-[#6B6CFF33]" : ""}`}
                        >
                          <img src={getFileIcon(file.name)} alt="file" className="h-[26px]" />
                          {!isSidebarCollapsed && (
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between max-w-full">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <p className={`text-[13px] truncate max-w-[165px] text-gray-700 font-medium mb-0.5`}>
                                        {file.name || f({ id: "noTitle" })}
                                      </p>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-gray-900 text-[12px] truncate text-white border-gray-900">
                                      {file.name || f({ id: "noTitle" })}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                              <p className="text-xs text-gray-400">{formatDate(file.create_time, locale === 'zh-CN' ? 'zh' : 'en')}</p>
                            </div>
                          )}
                          {!isSidebarCollapsed && (
                            <Trash2
                              className="h-4 w-4 flex-shrink-0 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400"
                              onClick={(e) => {
                                e.preventDefault();
                                deleteFile(file.id);
                              }}
                            />
                          )}
                        </Link>
                      )
                    })
                  )}
                </div>
              </ScrollArea>
            )
          }
          {/* Footer */}
          <div className="mt-auto">
            <div className="m-2 border-b border-color text-[#41464B99]">
              <div
                className={`flex p-2 ${isSidebarCollapsed ? 'justify-center' : 'pr-4 pl-4'} mb-1 rounded-2xl items-center gap-2 hover:bg-[#6B6CFF1A] hover:text-[#41464B] transition-all duration-200 cursor-pointer`}
                onClick={() => setSettingsOpen(true)}
              >
                <SettingsIcon className="h-4 w-4 cursor-pointer" />
                {!isSidebarCollapsed && <span className="text-[14px]">{f({ id: "settings.title" })}</span>}
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger className="w-full focus-visible:outline-none">
                <div className={`m-2 mt-1 flex rounded-2xl items-center gap-2 p-[10px] hover:bg-[#6B6CFF1A] hover:text-[#41464B] transition-all duration-200 cursor-pointer ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                  <img src={avatar} alt="avatar" className="w-8 h-8 rounded-full" />
                  {!isSidebarCollapsed && <span className="text-[14px]">{user?.username}</span>}
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setSettingsOpen(true)}>{f({ id: "ai.account" })}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/login')}>{f({ id: "user.logout" })}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      {/* Main Content */}
      < div
        className={`flex-1 transition-all duration-300 ease-in-out ${isSidebarCollapsed ? "ml-16" : "ml-62"}`
        }
      >
        <Outlet />
      </div >

      {/* Settings Dialog */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} defaultActiveMenu="account" />
    </div>
  )
}

import { IntlProvider } from "react-intl"
import zh from '@/locales/zh-CN'
import en from '@/locales/en-Us'

const messages: Record<string, any> = {
  'zh-CN': zh,
  'en-US': en
}

export default function ClientLayout() {
  const { locale } = useLanguage()
  useEffect(() => {
    console.log(locale, 'locale')
  }, [locale])
  return <IntlProvider locale={locale} messages={messages[locale]} defaultLocale="en-US">
    <ClientLayoutContent />
  </IntlProvider>
}

