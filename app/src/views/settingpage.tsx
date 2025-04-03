'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Bot, ArrowRight, Trash } from "lucide-react"
import { useState, useEffect } from "react"
import { useIntl } from "react-intl"
import { toast } from "sonner"
import { useFiles } from "@/providers/FileContext"
interface AIConfig {
  baseUrl: string
  textModel: string
  token: string
  name: string
  proxyUrl: string
  subservice: string
  inputMaxToken: number
  outputMaxToken: number
}

export default function SettingPage() {
  const [configs, setConfigs] = useState<AIConfig[]>([])
  const { formatMessage: f } = useIntl()
  const { getAiConfig, updateAiConfig } = useFiles()

  const fileds = [
    {
      id: "name",
      label: f({ id: "ai.name" }),
      required: true
    },
    {
      id: "baseUrl",
      label: f({ id: "ai.baseUrl" }),
      required: true
    },
    {
      id: "textModel",
      label: f({ id: "ai.textModel" }),
      required: true
    },
    {
      id: "token",
      label: f({ id: "ai.token" }),
      required: true
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
      min: 0
    },
    {
      id: "outputMaxToken",
      label: f({ id: "ai.outputMaxToken" }),
      type: "number",
      min: 0
    }
  ]

  useEffect(() => {
    getAiConfig().then((data) => {
      setConfigs(data)
    })
  }, [])

  const handleAddConfig = () => {
    setConfigs([...configs, {
      baseUrl: "",
      textModel: "",
      token: "",
      name: "",
      proxyUrl: "",
      subservice: "",
      inputMaxToken: 0,
      outputMaxToken: 0
    }])
  }

  const handleApplyConfig = () => {
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

    updateAiConfig(configs).then((data) => {
      console.log(data)
      toast.success(f({ id: "ai.applyConfigSuccess" }))
    })
  };


  const handleDeleteConfig = (index: number) => {
    setConfigs(configs.filter((_, i) => i !== index))
  }

  const handleInputChange = (index: number, field: string, value: string | number) => {
    const newConfigs = [...configs]
    newConfigs[index] = { ...newConfigs[index], [field]: value }
    setConfigs(newConfigs)
  }

  return (
    <div className="container mx-auto p-6 h-[100vh]">
      <Tabs defaultValue="ai" className="w-full h-full">
        <TabsList className=" w-full grid-cols-1 flex gap-4">
          <TabsTrigger value="ai" className="rounded-full"> <Bot className="h-4 w-4 mr-2" />AI</TabsTrigger>
        </TabsList>
        <TabsContent value="ai" className="h-[calc(100%-30px)]">
          <div className="space-y-4 h-full flex flex-col">
            <div className="space-y-4 overflow-y-auto">
              {configs.map((config, configIndex) => (
                <Card key={configIndex} className="border-1 border-gray-200">
                  <CardHeader className="flex flex-row justify-between pt-6 pb-3">
                    <CardTitle className="font-medium">{f({ id: "ai.model" })} <span className="text-gray-500 text-sm border-1 border-gray-200 rounded-full w-6 h-6 inline-flex items-center justify-center">{configIndex + 1}</span></CardTitle>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteConfig(configIndex)} className="text-gray-500 hover:text-red-500 cursor-pointer">
                      <Trash className="h-4 w-4 " />
                    </Button>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
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
                                  handleInputChange(
                                    configIndex,
                                    field.id,
                                    field.type === "number" ? Number.parseInt(e.target.value) || 0 : e.target.value,
                                  )
                                }
                                className="border-1 border-gray-200 focus-visible:ring-0 focus-visible:ring-offset-0"
                              />
                            </div>
                          )
                        })
                      }
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="flex gap-4 w-full justify-center bg-white p-1">
              <Button onClick={handleAddConfig} className="w-1/4 cursor-pointer border-1 border-gray-200 border-dashed rounded-full">
                <Plus className="mr-2 h-4 w-4" />
                {f({ id: "ai.addConfig" })}
              </Button>
              <Button onClick={handleApplyConfig} className="w-1/4 bg-gray-800 text-white rounded-full cursor-pointer">
                <ArrowRight className="mr-2 h-4 w-4" />
                {f({ id: "ai.applyConfig" })}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}