import type React from "react"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useIntl } from "react-intl"
import account from "@/assets/icon/account.png"
import preference from "@/assets/icon/preference.png"
import aiSettings from "@/assets/icon/ai-settings.png"
import billing from "@/assets/icon/billing.png"
import feedback from "@/assets/icon/feedback.png"
import avatar from "@/assets/icon/avatar.png"
import { useNavigate } from "react-router-dom"
import { isElectron, getUserInfo } from "@/utils/electron"
import { Select, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SelectContent, SelectItem } from "@/components/ui/select"
import { useLanguage } from "@/providers/LanguageContext"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useFiles } from "@/providers/FileContext"
import { toast } from "sonner"

interface SettingMenuItem {
  id: string
  icon: React.ReactNode
  component: React.ReactNode
}

interface SettingsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultActiveMenu?: string
}

interface AIConfig {
  id: number
  name: string
  baseUrl: string
  textModel: string
  token: string
  proxyUrl?: string
  subservice?: string
  inputMaxToken?: number
  outputMaxToken?: number
}

export default function Settings({ open, onOpenChange, defaultActiveMenu = "account" }: SettingsProps) {
  const { formatMessage: f } = useIntl()
  const [activeMenu, setActiveMenu] = useState(defaultActiveMenu)

  useEffect(() => {
    if (!open) {
      setActiveMenu(defaultActiveMenu)
    }
  }, [open])

  const menuItems: SettingMenuItem[] = [
    {
      id: "account",
      icon: <img src={account} alt="account" className="w-[18px] h-[18px]" />,
      component: <AccountSettings />,
    },
    {
      id: "preference",
      icon: <img src={preference} alt="preference" className="w-[16px] h-[16px]" />,
      component: <PreferenceSettings />,
    },
    {
      id: "aiSettings",
      icon: <img src={aiSettings} alt="aiSettings" className="w-[16px] h-[16px]" />,
      component: <AiSettings />,
    },
    {
      id: "billing",
      icon: <img src={billing} alt="billing" className="w-[20px] h-[20px]" />,
      component: <BillingSettings />,
    },
    {
      id: "feedback",
      icon: <img src={feedback} alt="feedback" className="w-[18px] h-[18px]" />,
      component: <FeedbackSettings />,
    },
  ]

  const activeComponent = menuItems.find((item) => item.id === activeMenu)?.component

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] p-3 overflow-hidden">
        <div className="flex h-full overflow-hidden">
          {/* 左侧菜单 */}
          <div className="w-46">
            <DialogHeader className="my-4">
              <DialogTitle className="text-xl font-[400] ml-3">{f({ id: "settings.title" })}</DialogTitle>
            </DialogHeader>
            <ScrollArea>
              <div className="space-y-1">
                {menuItems.map((item) => (
                  <Button
                    key={item.id}
                    variant={activeMenu === item.id ? "secondary" : "ghost"}
                    className={`w-full justify-start gap-2 ${activeMenu === item.id ? "bg-[#6B6CFF33]" : ""} hover:bg-[#6B6CFF1A] focus-visible:outline-none`}
                    onClick={() => setActiveMenu(item.id)}
                  >
                    {item.icon}
                    <span className="text-sm">{f({ id: `settings.${item.id}` })}</span>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* 右侧内容 */}
          <div className="flex-1 ml-3 px-6 py-3 bg-white h-full rounded-xl overflow-hidden relative">
            <div className="text-xl py-3 border-b border-[#41464B1A] mb-6">{f({ id: `settings.${activeMenu}` })}</div>
            <ScrollArea className="h-[calc(100%-80px)]">{activeComponent}</ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// 各个设置页面的组件
function AccountSettings() {
  const { formatMessage: f } = useIntl()
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
            throw new Error("用户信息获取失败")
          }
        } catch (error) {
          console.error("获取用户信息失败:", error)
        }
      } else {
        // 在浏览器环境中从 localStorage 获取用户信息
        userInfo = localStorage.getItem("user")
      }
      console.log(userInfo, "userInfo")
      if (!userInfo) {
        navigate("/login")
      } else {
        setUser(JSON.parse(userInfo))
        navigate("/")
      }
    }

    checkUserInfo()
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12 rounded-full overflow-hidden">
            <img src={avatar} alt="Profile picture" className="object-cover" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-[17px] text-gray-800">{user?.username}</div>
            <div className="text-[13px] text-[#41464B99]">User ID: {user?.id}</div>
          </div>
        </div>
        <Button variant="outline" className="text-gray-700">
          Log out
        </Button>
      </div>

      <div className="text-[#41464B99] text-sm px-1">{f({ id: "settings.accountInformation" })}</div>
      <div className="border border-color rounded-lg overflow-hidden">
        <div className="divide-y divide-[#41464B1A]">
          <div className="flex justify-between items-center p-4">
            <div className="flex flex-col gap-2">
              <div className="text-sm text-[#41464B99]">{f({ id: "settings.accountInformation.username" })}</div>
              <div className="text-gray-800">{user?.username}</div>
            </div>
            {/* <Button variant="destructive" size="sm" className="h-9 px-4">
              {f({ id: "settings.accountInformation.edit" })}
            </Button> */}
          </div>

          <div className="flex justify-between items-center p-4">
            <div className="flex flex-col gap-2">
              <div className="text-sm text-[#41464B99]">{f({ id: "settings.accountInformation.email" })}</div>
              <div className="text-gray-800">{user?.email}</div>
            </div>
            {/* <Button variant="destructive" size="sm" className="h-9 px-4">
              {f({ id: "settings.accountInformation.edit" })}
            </Button> */}
          </div>

          <div className="flex justify-between items-center p-4">
            <div className="flex flex-col gap-2">
              <div className="text-sm text-[#41464B99]">{f({ id: "settings.accountInformation.accountVersion" })}</div>
              <div className="text-gray-800">{user?.accountType}</div>
            </div>
            <Button className="bg-primary-gradient text-white" size="sm">
              {f({ id: "settings.accountInformation.upgrade" })}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PreferenceSettings() {
  const { formatMessage: f } = useIntl()
  const { locale, setLocale } = useLanguage()
  return (
    <div className="space-y-4">
      <div className="text-[#41464B99] text-sm px-1">{f({ id: "settings.systemSettings" })}</div>
      <div className="border border-color rounded-lg overflow-hidden">
        <div className="divide-y divide-[#41464B1A]">
          <div className="flex justify-between items-center p-4">
            <div className="flex flex-col gap-2">
              <div>{f({ id: "settings.systemLanguage" })}</div>
            </div>
            <Select defaultValue={locale} onValueChange={setLocale}>
              <SelectTrigger className="border-none w-26 focus:shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en-US">English</SelectItem>
                <SelectItem value="zh-CN">中文</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  )
}

function AiSettings() {
  const { formatMessage: f } = useIntl()
  const [editMode, setEditMode] = useState<{ type: "add" | "edit", id: number } | null>()
  const [isHover, setIsHover] = useState<Record<number, boolean>>({})
  const defaultConfig = {
    id: 0,
    name: "",
    baseUrl: "",
    textModel: "",
    token: "",
    proxyUrl: "",
    subservice: "",
    inputMaxToken: 0,
    outputMaxToken: 0,
  }
  const [config, setConfig] = useState<AIConfig>(defaultConfig)

  // Mock MCP server data
  const [aiConfigs, setAiConfigs] = useState<AIConfig[]>([])

  const { getAiConfig, updateAiConfig } = useFiles()

  useEffect(() => {
    getList()
  }, [])

  const getList = () => {
    getAiConfig().then((data) => {
      setAiConfigs(data)
    })
  }

  const handleEditServer = (config: AIConfig) => {
    setEditMode({ type: "edit", id: config.id })
    setConfig(config)
  }

  const handleAddServer = () => {
    setEditMode({ type: "add", id: 0 })
  }

  const handleSaveServer = () => {
    let configs
    if (editMode?.type === "add") {
      configs = [...aiConfigs, config]
    } else {
      configs = aiConfigs.map((item) => {
        if (item.id === config.id) {
          return config
        }
        return item
      })
    }
    if (configs.length !== 0) {

      console.log(configs);
      // 1. 检查 基础URL 和 模型 的组合是否重复
      const seenConfigs = new Map(); // 用于存储 baseUrl 和 textModel 的组合
      const duplicateDetails: string[] = [];

      configs.forEach((config, index) => {
        const key = `${config.baseUrl}_${config.textModel}`; // 创建唯一标识符
        if (seenConfigs.has(key)) {
          // 如果该组合已经出现过，记录重复配置
          duplicateDetails.push(`配置 #${index + 1}（基础URL: ${config.baseUrl}, 模型: ${config.textModel}）`);
        } else {
          // 否则，将该组合存入 Map
          seenConfigs.set(key, index);
        }
      });

      // 如果有重复的配置，提示错误
      if (duplicateDetails.length > 0) {
        toast.error(`${f({ id: "ai.duplicateConfig" })}: ${duplicateDetails.join('; ')}`);
        return;
      }

      // 2. 检查必填项是否缺失
      const missingFieldsMap: Record<number, string[]> = {}; // 记录每个配置项缺失的字段
      const requiredFields = fileds.filter((field) => field.required);

      configs.forEach((config, index) => {
        requiredFields.forEach((field) => {
          if (!config[field.id as keyof AIConfig]) {
            if (!missingFieldsMap[index]) {
              missingFieldsMap[index] = [];
            }
            missingFieldsMap[index].push(field.label);
          }
        });
      });

      if (Object.keys(missingFieldsMap).length > 0) {
        const missingDetails = Object.entries(missingFieldsMap)
          .map(([index, fields]) => `#${Number(index) + 1}: ${fields.join('、')}`)
          .join('; ');

        toast.error(`${f({ id: "ai.requiredFields" })}: ${missingDetails}`);
        return;
      }
    }
    updateAiConfig(configs).then(() => {
      toast.success(f({ id: "ai.applyConfigSuccess" }))
      setEditMode(null)
      setConfig(defaultConfig)
      getList()
    })
  }

  const handleBackToList = () => {
    setEditMode(null)
    setConfig(defaultConfig)
  }

  const handleDeleteServer = (id: number) => {
    let configs = aiConfigs.filter((item) => item.id !== id)
    updateAiConfig(configs).then(() => {
      getList()
    })
  }

  const fileds = [
    {
      id: "name",
      label: f({ id: "ai.name" }),
      required: true,
    },
    {
      id: "baseUrl",
      label: f({ id: "ai.baseUrl" }),
      required: true,
    },
    {
      id: "textModel",
      label: f({ id: "ai.textModel" }),
      required: true,
    },
    {
      id: "token",
      label: f({ id: "ai.token" }),
      required: true,
    },
    {
      id: "proxyUrl",
      label: f({ id: "ai.proxyUrl" }),
    },
    {
      id: "subservice",
      label: f({ id: "ai.subservice" }),
    },
    {
      id: "inputMaxToken",
      label: f({ id: "ai.inputMaxToken" }),
      type: "number",
      min: 0,
    },
    {
      id: "outputMaxToken",
      label: f({ id: "ai.outputMaxToken" }),
      type: "number",
      min: 0,
    },
  ]

  return (
    <div className="space-y-6">
      {/* <div className="flex bg-[#EEF2FF] rounded-lg p-1 mb-4 gap-1">
        <button
          className={`flex-1 text-md py-1.5 rounded-lg text-center ${activeTab === "aiModel" ? "bg-white" : "hover:bg-[#6B6CFF1A]"}`}
          onClick={() => setActiveTab("aiModel")}
        >
          AI Models
        </button>
        <button
          disabled={true}
          className={`flex-1 text-md py-1.5 rounded-lg text-center ${activeTab === "mcpServer" ? "bg-white" : "hover:bg-[#6B6CFF1A]"}`}
          onClick={() => {
            setActiveTab("mcpServer")
            setEditMode(false)
            setCurrentServer(null)
          }}
        >
          MCP Server
        </button>
      </div> */}

      {editMode ? (
        <div className="space-y-2 fixed top-8 bg-white w-[calc(100%-260px)] h-[calc(100%-45px)]">
          <div className="flex items-center mb-4">
            <Button variant="ghost" className="p-2 mr-2" onClick={handleBackToList}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-chevron-left"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </Button>
            <h2 className="text-xl">AI Conifg Settings</h2>
          </div>
          <div className="h-[calc(100%-120px)] overflow-auto space-y-4 scrollbar-thin">
            {
              fileds.map((field, index) => {
                return (
                  <div className="space-y-2" key={index}>
                    <Label htmlFor={`${field.id}-${index}`} className="text-gray-700">
                      {field.required && <span className="text-red-500">*</span>}
                      {field.label}
                    </Label>

                    <Input
                      id={`${field.id}-${index}`}
                      value={config[field.id as keyof AIConfig] ?? ""}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          [field.id]: e.target.value
                        })
                      }
                      className="border-1 border-gray-200 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>
                )
              })
            }
          </div>
          <div className="flex justify-end">
            <Button className="bg-[#6B6CFF] hover:bg-[#5858FF] text-white" onClick={handleSaveServer}>
              Save
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {aiConfigs.map((config) => (
            <div key={config.id} className="border border-[#E2E8F0] bg-[#F8FAFC] rounded-lg p-4" onMouseEnter={() => setIsHover({ ...isHover, [config.id]: true })} onMouseLeave={() => setIsHover({ ...isHover, [config.id]: false })}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-[#EEF2FF] rounded-full flex items-center justify-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path fill-rule="evenodd" clip-rule="evenodd" d="M2.1001 5.69998C2.1001 4.70079 2.80408 3.59998 4.0001 3.59998H20.0001C21.1961 3.59998 21.9001 4.70079 21.9001 5.69998V9.29998C21.9001 10.2992 21.1961 11.4 20.0001 11.4H4.0001C2.80408 11.4 2.1001 10.2992 2.1001 9.29998V5.69998ZM3.98439 5.42761C3.94507 5.4748 3.9001 5.56818 3.9001 5.69998V9.29998C3.9001 9.43177 3.94507 9.52516 3.98439 9.57234C3.99734 9.58788 4.00696 9.596 4.01273 9.59998H19.9875C19.9932 9.596 20.0029 9.58788 20.0158 9.57234C20.0551 9.52516 20.1001 9.43177 20.1001 9.29998V5.69998C20.1001 5.56818 20.0551 5.4748 20.0158 5.42761C20.0029 5.41208 19.9932 5.40395 19.9875 5.39998H4.01273C4.00696 5.40395 3.99734 5.41208 3.98439 5.42761ZM4.01904 5.39663C4.01906 5.39678 4.01796 5.39742 4.01567 5.3981C4.01787 5.39682 4.01901 5.39648 4.01904 5.39663ZM19.9812 5.39663C19.9812 5.39648 19.9823 5.39682 19.9845 5.3981C19.9822 5.39742 19.9811 5.39678 19.9812 5.39663ZM19.9812 9.60332C19.9811 9.60316 19.9822 9.60253 19.9845 9.60185C19.9823 9.60314 19.9812 9.60348 19.9812 9.60332ZM4.01904 9.60332C4.01901 9.60347 4.01787 9.60313 4.01567 9.60185C4.01796 9.60253 4.01906 9.60317 4.01904 9.60332Z" fill="#6B6CFF" />
                      <path fill-rule="evenodd" clip-rule="evenodd" d="M5.1001 7.49998C5.1001 7.00292 5.50304 6.59998 6.0001 6.59998H8.0001C8.49715 6.59998 8.9001 7.00292 8.9001 7.49998C8.9001 7.99703 8.49715 8.39998 8.0001 8.39998H6.0001C5.50304 8.39998 5.1001 7.99703 5.1001 7.49998Z" fill="#6B6CFF" />
                      <path fill-rule="evenodd" clip-rule="evenodd" d="M5.1001 16.5C5.1001 16.0029 5.50304 15.6 6.0001 15.6H8.0001C8.49715 15.6 8.9001 16.0029 8.9001 16.5C8.9001 16.997 8.49715 17.4 8.0001 17.4H6.0001C5.50304 17.4 5.1001 16.997 5.1001 16.5Z" fill="#6B6CFF" />
                      <path fill-rule="evenodd" clip-rule="evenodd" d="M2.1001 14.7C2.1001 13.7008 2.80408 12.6 4.0001 12.6H20.0001C21.1961 12.6 21.9001 13.7008 21.9001 14.7V18.3C21.9001 19.2992 21.1961 20.4 20.0001 20.4H4.0001C2.80408 20.4 2.1001 19.2992 2.1001 18.3V14.7ZM3.98439 14.4276C3.94507 14.4748 3.9001 14.5682 3.9001 14.7V18.3C3.9001 18.4318 3.94507 18.5252 3.98439 18.5723C3.99734 18.5879 4.00696 18.596 4.01273 18.6H19.9875C19.9932 18.596 20.0029 18.5879 20.0158 18.5723C20.0551 18.5252 20.1001 18.4318 20.1001 18.3V14.7C20.1001 14.5682 20.0551 14.4748 20.0158 14.4276C20.0029 14.4121 19.9932 14.4039 19.9875 14.4H4.01273C4.00696 14.4039 3.99734 14.4121 3.98439 14.4276ZM4.01904 14.3966C4.01906 14.3968 4.01796 14.3974 4.01567 14.3981C4.01787 14.3968 4.01901 14.3965 4.01904 14.3966ZM19.9812 14.3966C19.9812 14.3965 19.9823 14.3968 19.9845 14.3981C19.9822 14.3974 19.9811 14.3968 19.9812 14.3966ZM19.9812 18.6033C19.9811 18.6032 19.9822 18.6025 19.9845 18.6019C19.9823 18.6031 19.9812 18.6035 19.9812 18.6033ZM4.01904 18.6033C4.01901 18.6035 4.01787 18.6031 4.01567 18.6019C4.01796 18.6025 4.01906 18.6032 4.01904 18.6033Z" fill="#6B6CFF" />
                    </svg>

                  </div>
                  <div>
                    <h3 className="font-medium">{config.name}</h3>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {
                    isHover[config.id] && (
                      <>
                        <button
                          className="text-gray-400 hover:text-gray-600"
                          onClick={() => handleDeleteServer(config.id)}
                        >
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path fill-rule="evenodd" clip-rule="evenodd" d="M4.92543 6.75378C5.33759 6.71256 5.70512 7.01327 5.74633 7.42543L6.44617 14.4238C6.50036 14.9657 6.53725 15.3292 6.58747 15.6089C6.63604 15.8794 6.68796 16.0126 6.74253 16.1034C6.8782 16.3292 7.07772 16.5098 7.31591 16.6223C7.41171 16.6676 7.54936 16.706 7.82337 16.7274C8.10664 16.7495 8.4721 16.7501 9.01668 16.7501H10.9834C11.528 16.7501 11.8935 16.7495 12.1767 16.7274C12.4508 16.706 12.5884 16.6676 12.6842 16.6223C12.9224 16.5098 13.1219 16.3292 13.2576 16.1034C13.3122 16.0126 13.3641 15.8794 13.4126 15.6089C13.4629 15.3292 13.4998 14.9656 13.5539 14.4238L14.2538 7.42543C14.295 7.01327 14.6625 6.71256 15.0747 6.75378C15.4868 6.79499 15.7875 7.16253 15.7463 7.57468L15.0436 14.6017C14.9931 15.1075 14.9508 15.5298 14.889 15.874C14.8244 16.2338 14.7295 16.5661 14.5434 16.8759C14.2551 17.3557 13.8311 17.7394 13.3249 17.9786C12.9982 18.1329 12.6581 18.1943 12.2936 18.2228C11.945 18.2501 11.5206 18.2501 11.0122 18.2501H8.98787C8.47954 18.2501 8.05515 18.2501 7.70649 18.2228C7.34201 18.1943 7.00195 18.1329 6.67519 17.9786C6.16902 17.7394 5.74504 17.3557 5.45674 16.8759C5.27063 16.5661 5.17569 16.2338 5.11108 15.874C5.04927 15.5298 5.00705 15.1075 4.95648 14.6017L4.25378 7.57468C4.21256 7.16253 4.51327 6.79499 4.92543 6.75378Z" fill="#F57878" />
                            <path fill-rule="evenodd" clip-rule="evenodd" d="M11.25 8C11.6642 8 12 8.33579 12 8.75V12.9167C12 13.3309 11.6642 13.6667 11.25 13.6667C10.8358 13.6667 10.5 13.3309 10.5 12.9167V8.75C10.5 8.33579 10.8358 8 11.25 8Z" fill="#F57878" />
                            <path fill-rule="evenodd" clip-rule="evenodd" d="M8.75 8C9.16421 8 9.5 8.33579 9.5 8.75V12.9167C9.5 13.3309 9.16421 13.6667 8.75 13.6667C8.33579 13.6667 8 13.3309 8 12.9167V8.75C8 8.33579 8.33579 8 8.75 8Z" fill="#F57878" />
                            <path fill-rule="evenodd" clip-rule="evenodd" d="M8.65387 3.33937L8.46222 4.66667H11.5378L11.3461 3.33937C11.334 3.30257 11.3151 3.27881 11.2996 3.26567C11.2822 3.25092 11.2707 3.25 11.2662 3.25H8.73383C8.72927 3.25 8.71785 3.25092 8.7004 3.26567C8.68487 3.27881 8.66596 3.30257 8.65387 3.33937ZM13.0533 4.66667L12.8247 3.08322C12.8217 3.06258 12.8179 3.04207 12.8132 3.02175C12.6498 2.31385 12.0392 1.75 11.2662 1.75H8.73383C7.96082 1.75 7.35017 2.31385 7.18681 3.02175C7.18212 3.04207 7.17828 3.06258 7.1753 3.08322L6.94667 4.66667H3.75C3.33579 4.66667 3 5.00245 3 5.41667C3 5.83088 3.33579 6.16667 3.75 6.16667H16.25C16.6642 6.16667 17 5.83088 17 5.41667C17 5.00245 16.6642 4.66667 16.25 4.66667H13.0533Z" fill="#F57878" />
                          </svg>
                        </button>
                        <button
                          className="px-4 py-1 border border-gray-200 rounded-md text-sm"
                          onClick={() => handleEditServer(config)}
                        >
                          Edit
                        </button>
                      </>
                    )
                  }
                  <div className="w-12 h-6 relative">
                    <Switch defaultChecked disabled />

                  </div>
                </div>
              </div>
            </div>
          ))}

          <div className="flex justify-end mt-2">
            <Button className="bg-[#6B6CFF] hover:bg-[#5858FF] text-white" onClick={handleAddServer}>Add Config</Button>
          </div>
        </div>
      )}
    </div>
  )
}

function BillingSettings() {
  const { formatMessage: f } = useIntl()

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="border border-[#E2E8F0] rounded-lg overflow-hidden">
          <div className="p-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-lg font-medium">Basic * 36 months</span>
                <span className="px-3 py-1 bg-green-100 text-green-600 rounded-full text-sm">Succeeded</span>
              </div>
              <div className="flex flex-col items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-chevron-down"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
            </div>
          </div>

          <div className="border-t border-[#E2E8F0]">
            <div className="flex justify-between items-center p-4 border-b border-[#E2E8F0]">
              <div className="text-gray-500">Order Number</div>
              <div>2025080466</div>
            </div>
            <div className="flex justify-between items-center p-4 border-b border-[#E2E8F0]">
              <div className="text-gray-500">Amount(Dollar)</div>
              <div>324</div>
            </div>
            <div className="flex justify-between items-center p-4">
              <div className="text-gray-500">Payment Time</div>
              <div>Aug 4, 2025, 16:59</div>
            </div>
          </div>
        </div>

        <div className="border border-[#E2E8F0] rounded-lg overflow-hidden">
          <div className="p-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-lg font-medium">Pro * 36 months</span>
                <span className="px-3 py-1 bg-red-100 text-red-600 rounded-full text-sm">Failed</span>
              </div>
              <div className="flex flex-col items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-chevron-down"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div className="border border-[#E2E8F0] rounded-lg overflow-hidden">
          <div className="p-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-lg font-medium">Pro * 24 months</span>
                <span className="px-3 py-1 bg-red-100 text-red-600 rounded-full text-sm">Failed</span>
              </div>
              <div className="flex flex-col items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-chevron-down"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
            </div>
          </div>

          <div className="border-t border-[#E2E8F0]">
            <div className="flex justify-between items-center p-4 border-b border-[#E2E8F0]">
              <div className="text-gray-500">Order Number</div>
              <div>2025080466</div>
            </div>
            <div className="flex justify-between items-center p-4 border-b border-[#E2E8F0]">
              <div className="text-gray-500">Amount(Dollar)</div>
              <div>456</div>
            </div>
            <div className="flex justify-between items-center p-4">
              <div className="text-gray-500">Payment Time</div>
              <div>Jul 23, 2025, 16:59</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FeedbackSettings() {
  const { formatMessage: f } = useIntl()

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="border border-[#E2E8F0] rounded-xl overflow-hidden">
          <div className="p-4 flex items-center">
            <div className="w-12 h-12 bg-[#F1F5F9] rounded-full flex items-center justify-center mr-4">
              <svg width="20" height="18" viewBox="0 0 20 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M6.0001 2.39998C4.8403 2.39998 3.9001 3.34018 3.9001 4.49998C3.9001 5.12184 4.16926 5.67965 4.60032 6.06546C4.97069 6.39695 5.00221 6.96593 4.67072 7.3363C4.33922 7.70668 3.77025 7.7382 3.39987 7.4067C2.60344 6.69387 2.1001 5.65511 2.1001 4.49998C2.1001 2.34606 3.84619 0.599976 6.0001 0.599976C6.99838 0.599976 7.91093 0.976231 8.60032 1.59325C8.97069 1.92474 9.00221 2.49372 8.67072 2.86409C8.33922 3.23447 7.77025 3.26598 7.39987 2.93449C7.02775 2.60143 6.53852 2.39998 6.0001 2.39998ZM11.3999 1.59325C12.0893 0.97623 13.0018 0.599976 14.0001 0.599976C16.154 0.599976 17.9001 2.34606 17.9001 4.49998C17.9001 5.65511 17.3968 6.69387 16.6003 7.4067C16.2299 7.7382 15.661 7.70668 15.3295 7.3363C14.998 6.96593 15.0295 6.39695 15.3999 6.06546C15.8309 5.67965 16.1001 5.12184 16.1001 4.49998C16.1001 3.34018 15.1599 2.39998 14.0001 2.39998C13.4617 2.39998 12.9724 2.60143 12.6003 2.93449C12.2299 3.26598 11.661 3.23447 11.3295 2.86409C10.998 2.49372 11.0295 1.92474 11.3999 1.59325ZM10.0001 5.39998C8.8403 5.39998 7.9001 6.34018 7.9001 7.49998C7.9001 8.65977 8.8403 9.59997 10.0001 9.59997C11.1599 9.59997 12.1001 8.65977 12.1001 7.49998C12.1001 6.34018 11.1599 5.39998 10.0001 5.39998ZM6.1001 7.49998C6.1001 5.34606 7.84619 3.59998 10.0001 3.59998C12.154 3.59998 13.9001 5.34606 13.9001 7.49998C13.9001 9.65389 12.154 11.4 10.0001 11.4C7.84619 11.4 6.1001 9.65389 6.1001 7.49998ZM4.87068 10.5218C4.99672 11.0026 4.70913 11.4945 4.22832 11.6206C3.4493 11.8248 2.83834 12.1481 2.43968 12.5066C2.04348 12.8629 1.9001 13.208 1.9001 13.5003C1.9001 13.9974 1.49715 14.4003 1.0001 14.4003C0.503041 14.4003 0.100098 13.9974 0.100098 13.5003C0.100098 12.5625 0.573766 11.7638 1.23608 11.1682C1.89595 10.5748 2.78499 10.1381 3.77187 9.87939C4.25268 9.75335 4.74464 10.0409 4.87068 10.5218ZM15.1295 10.5218C15.2556 10.0409 15.7475 9.75335 16.2283 9.87939C17.2152 10.1381 18.1042 10.5748 18.7641 11.1682C19.4264 11.7638 19.9001 12.5625 19.9001 13.5003C19.9001 13.9974 19.4972 14.4003 19.0001 14.4003C18.503 14.4003 18.1001 13.9974 18.1001 13.5003C18.1001 13.208 17.9567 12.8629 17.5605 12.5066C17.1619 12.1481 16.5509 11.8248 15.7719 11.6206C15.2911 11.4945 15.0035 11.0026 15.1295 10.5218ZM6.00152 13.6069C7.06845 12.9668 8.48431 12.6 10.0001 12.6C11.5159 12.6 12.9317 12.9668 13.9987 13.6069C15.0477 14.2363 15.9001 15.2312 15.9001 16.5C15.9001 16.997 15.4972 17.4 15.0001 17.4C14.503 17.4 14.1001 16.997 14.1001 16.5C14.1001 16.1119 13.8332 15.6068 13.0726 15.1504C12.3299 14.7048 11.2457 14.4 10.0001 14.4C8.75446 14.4 7.67032 14.7048 6.92761 15.1504C6.16699 15.6068 5.9001 16.1119 5.9001 16.5C5.9001 16.997 5.49715 17.4 5.0001 17.4C4.50304 17.4 4.1001 16.997 4.1001 16.5C4.1001 15.2312 4.9525 14.2363 6.00152 13.6069Z" fill="#6B6CFF" />
              </svg>

            </div>
            <div className="flex-1">
              <h3 className="text-md font-medium mb-1">{f({ id: "settings.ourCommunity" })}</h3>
              <span className="text-gray-500">www.hdhouoidahj.com</span>
            </div>
            <Button variant="outline" className="rounded-full px-6">
              Open Page
            </Button>
          </div>
        </div>

        <div className="border border-[#E2E8F0] rounded-xl overflow-hidden">
          <div className="p-4 flex items-center">
            <div className="w-14 h-14 bg-[#F1F5F9] rounded-full flex items-center justify-center mr-4">
              <svg width="22" height="18" viewBox="0 0 22 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M6.11943 0.599976H15.8805C16.6886 0.599965 17.3494 0.599957 17.8865 0.643838C18.4424 0.689258 18.9445 0.78614 19.4134 1.02505C20.1472 1.39896 20.7439 1.99558 21.1178 2.72941C21.3567 3.1983 21.4536 3.70038 21.499 4.25629C21.5052 4.33219 21.5105 4.41055 21.5151 4.49145C21.5463 4.61371 21.551 4.73992 21.5307 4.86184C21.5429 5.2703 21.5429 5.73493 21.5428 6.26225V11.7377C21.5429 12.5457 21.5429 13.2066 21.499 13.7437C21.4536 14.2996 21.3567 14.8017 21.1178 15.2705C20.7439 16.0044 20.1472 16.601 19.4134 16.9749C18.9445 17.2138 18.4424 17.3107 17.8865 17.3561C17.3494 17.4 16.6886 17.4 15.8805 17.4H6.11946C5.31139 17.4 4.65053 17.4 4.11344 17.3561C3.55753 17.3107 3.05545 17.2138 2.58656 16.9749C1.85273 16.601 1.25611 16.0044 0.882201 15.2705C0.643291 14.8017 0.546408 14.2996 0.500988 13.7437C0.457107 13.2066 0.457116 12.5457 0.457127 11.7377V6.26227C0.45712 5.73494 0.457114 5.2703 0.469306 4.86184C0.449015 4.73992 0.453659 4.6137 0.484892 4.49144C0.489464 4.41054 0.494788 4.33218 0.500988 4.25629C0.546408 3.70038 0.643291 3.1983 0.882201 2.72941C1.25611 1.99558 1.85273 1.39896 2.58656 1.02505C3.05545 0.78614 3.55753 0.689258 4.11344 0.643838C4.65052 0.599957 5.31137 0.599965 6.11943 0.599976ZM2.25713 6.39593V11.7C2.25713 12.5549 2.25783 13.142 2.29501 13.5971C2.33134 14.0417 2.39794 14.2805 2.48601 14.4534C2.68735 14.8485 3.00861 15.1698 3.40375 15.3711C3.57659 15.4592 3.81542 15.5258 4.26002 15.5621C4.71513 15.5993 5.3022 15.6 6.15713 15.6H15.8428C16.6978 15.6 17.2848 15.5993 17.7399 15.5621C18.1845 15.5258 18.4234 15.4592 18.5962 15.3711C18.9914 15.1698 19.3126 14.8485 19.514 14.4534C19.602 14.2805 19.6686 14.0417 19.705 13.5971C19.7421 13.142 19.7428 12.5549 19.7428 11.7V6.39593L14.1618 10.1166C14.1182 10.1457 14.0753 10.1743 14.033 10.2026C13.1968 10.7607 12.588 11.1672 11.9088 11.3299C11.3114 11.4731 10.6886 11.4731 10.0911 11.3299C9.41198 11.1672 8.80313 10.7607 7.96701 10.2026C7.92466 10.1743 7.88174 10.1457 7.83819 10.1166L2.25713 6.39593ZM19.6922 4.26636L13.1633 8.61895C12.1422 9.29968 11.8159 9.50122 11.4894 9.57946C11.1677 9.65655 10.8323 9.65655 10.5106 9.57946C10.1841 9.50122 9.85775 9.29968 8.83665 8.61895L2.30777 4.26636C2.34591 3.90765 2.40742 3.70085 2.48601 3.5466C2.68735 3.15146 3.00861 2.8302 3.40375 2.62886C3.57659 2.54079 3.81542 2.47419 4.26002 2.43786C4.71513 2.40068 5.3022 2.39998 6.15713 2.39998H15.8428C16.6978 2.39998 17.2848 2.40068 17.7399 2.43786C18.1845 2.47419 18.4234 2.54079 18.5962 2.62886C18.9914 2.8302 19.3126 3.15146 19.514 3.5466C19.5926 3.70085 19.6541 3.90765 19.6922 4.26636Z" fill="#6B6CFF" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-md font-medium mb-1">{f({ id: "settings.ourEmail" })}</h3>
              <span className="text-gray-500">dhoiahdoiahdo@gmail.com</span>
            </div>
            <Button variant="outline" className="rounded-full px-6">
              Open Page
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
