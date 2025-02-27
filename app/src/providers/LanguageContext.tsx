import type React from "react"
import { createContext, useState, useContext, type ReactNode } from "react"
export type Language = keyof typeof translations

export const translations = {
  en: {
    newChat: "New Chat",
    chatOffice: "AIChatOffice",
    recentFiles: "Recent Files",
    language: "Language",
    selectFile: "Select File",
    "chat.placeholder": "Ask anything...",
    "chat.greeting.1": "Hello! Nice to meet you!",
    "chat.greeting.2": "It seems you have a document to discuss. I'm happy to help you.",
    "chat.greeting.3": "This document contains some interesting topics and discoveries.",
    "chat.greeting.4": "It may involve some important issues worth discussing.",
    "chat.greeting.5": "I can help you analyze and understand the content in depth.",
    "chat.greeting.6": "What aspects do you want to know?",
    "chat.summary": "Summarize the document",
    "chat.summary.1": `I have read this document carefully. Let me summarize the main content for you:\n1. The main points of the document\n   - Core points and discoveries\n   - Research methods and processes\n   - Important conclusions\n\n2. Key points\n   - Important data and evidence\n   - Innovations\n   - Practical application value\n\n3. Suggestions and insights\n   - Impact on related fields\n   - Future research directions\n\nWhich aspect do you want to know in more detail? I can provide a more detailed analysis for you.`,
    "chat.summary.2": "I have read your question. Let me analyze the content related to the document:",
    "homepage.title": "Chat with any Document",
    "homepage.description": "With Chatoffice, easily interact with PDFs, Words and more, quickly extracting key information to boost your productivity.",
    "homepage.chatInterface": "Chat Interface",
    "homepage.aiPowered": "AI-Powered",
    "homepage.smartInsights": "Smart Insights",
    "homepage.uploadFiles": "Click to upload, or drag and drop files here",
    "homepage.supportedFiles": "Supported files: .docx, .xlsx, .pptx, .pdf",
    "homepage.getStarted": "Get Started",
    "homepage.viewDemo": "View Demo",
    "homepage.featuredOn": "Featured on",
    "homepage.powerfulFeatures": "Powerful Features for Your Workflow",
    "homepage.documentPreview": "Document Preview & Interaction",
    "homepage.documentPreviewDescription": "AI allows you to converse naturally with your documents. Whether you need a summary, specific details, or even suggestions, Chatoffice provides intelligent responses tailored to your needs.",
    "homepage.multiFormatSupport": "Multi-Format Support",
    "homepage.intuitiveInterface": "Intuitive Interface",
    "homepage.fullTextSearch": "Full-text search functionality",
    "homepage.aiPoweredConversation": "AI-Powered Conversation",
    "homepage.aiPoweredConversationDescription": "Chat with AI to gain insights, clarify information, or explore further content within your documents. The AI is trained to understand the context of each section, table, or slide.",
    "homepage.naturalLanguageProcessing": "Natural Language Processing",
    "homepage.contextUnderstanding": "Context Understanding",
    "homepage.multiTurnDialogue": "Multi-Turn Dialogue",
    "homepage.wideCompatibility": "Wide Compatibility",
    "homepage.seamlessConversion": "Seamless Conversion",
    "homepage.formatRetention": "Format Retention",
    "homepage.multiFormatSupportDescription": "Open, interact, and chat with a wide variety of file formats, including .docx, .xlsx, .pptx, and more, ensuring full compatibility with your Office documents.",
    "homepage.seamlessWorkflow": "Seamless Workflow",
    "homepage.seamlessWorkflowDescription": "Navigate and interact with your documents effortlessly. No more switching between tools—Chatoffice combines the power of AI and Office documents in one place.",
    "homepage.integratedExperience": "Integrated Experience",
    "homepage.quickNavigation": "Quick Navigation",
    "homepage.autoSave": "Auto-Save",
    "homepage.highlights": "Highlights Of AIChatOffice",
    "homepage.intuitiveAIIntegration": "Intuitive AI Integration",
    "homepage.intuitiveAIIntegrationDescription": "Converse naturally with your documents",
    "homepage.efficientContentExtraction": "Efficient Content Extraction",
    "homepage.efficientContentExtractionDescription": "Easily extract key sections, enhancing your productivity.",
    "homepage.fastResponse": "Fast Response",
    "homepage.fastResponseDescription": "Use advanced algorithms to improve processing efficiency and reduce waiting time.",
    "homepage.easeOfUse": "Ease of Use",
    "homepage.easeOfUseDescription": "The user interface is simple and easy to use, supporting Chinese and English languages",
    "homepage.transformYourDocumentManagementExperience": "Transform your document management experience",
    "homepage.product": "Product",
    "homepage.company": "Company",
    "homepage.resources": "Resources",
  },
  zh: {
    newChat: "新建聊天",
    chatOffice: "AIChatOffice",
    recentFiles: "最近文件",
    language: "语言",
    selectFile: "选择文件",
    "chat.placeholder": "随便问个问题...",
    "chat.greeting.1": "你好！很高兴见到你!",
    "chat.greeting.2": "看来你有一份文档需要讨论，我很乐意为你提供帮助。",
    "chat.greeting.3": "这份文档包含了一些有趣的主题和发现",
    "chat.greeting.4": "其中可能涉及一些值得讨论的重要问题",
    "chat.greeting.5": "我可以帮你深入分析和理解内容",
    "chat.greeting.6": "你想了解哪些方面呢？",
    "chat.summary": "总结本文",
    "chat.summary.1": `我已经仔细阅读了这份文档，让我为您总结主要内容：\n1. 文档的主要论点\n   - 核心观点和发现\n   - 研究方法和过程\n   - 重要结论\n\n2. 关键要点\n   - 重要数据和证据\n   - 创新之处\n   - 实际应用价值\n\n3. 建议和启示\n   - 对相关领域的影响\n   - 未来研究方向\n\n您想深入了解哪个方面？我可以为您提供更详细的分析。`,
    "chat.summary.2": `我已经看了您的问题。让我来分析一下文档中相关的内容：\n\n这个问题涉及到文档中的几个重要观点：\n1. ...\n2. ...\n\n您觉得这个解释有帮助吗？如果需要更详细的说明，我很乐意为您进一步解释。`,
    "homepage.title": "与任何文档聊天",
    "homepage.description": "使用Chatoffice，轻松与PDF、Word等文档互动，快速提取关键信息，提升工作效率。",
    "homepage.chatInterface": "聊天界面",
    "homepage.aiPowered": "AI驱动",
    "homepage.smartInsights": "智能洞察",
    "homepage.uploadFiles": "点击上传，或拖拽文件到这里",
    "homepage.supportedFiles": "支持的文件类型: .docx, .xlsx, .pptx, .pdf",
    "homepage.getStarted": "开始使用",
    "homepage.viewDemo": "查看演示",
    "homepage.featuredOn": "主打",
    "homepage.powerfulFeatures": "强大的工作流程功能",
    "homepage.documentPreview": "文档预览与交互",
    "homepage.documentPreviewDescription": "AI允许您自然地与文档对话。无论您需要总结、特定细节还是建议，Chatoffice都能提供智能化的响应，满足您的需求。",
    "homepage.multiFormatSupport": "多格式支持",
    "homepage.intuitiveInterface": "直观界面",
    "homepage.fullTextSearch": "全文搜索功能",
    "homepage.aiPoweredConversation": "AI驱动对话",
    "homepage.aiPoweredConversationDescription": "与AI对话，获取见解、澄清信息或探索文档中的更多内容。AI被训练来理解每个部分、表格或幻灯片的上下文。",
    "homepage.naturalLanguageProcessing": "自然语言处理",
    "homepage.contextUnderstanding": "上下文理解",
    "homepage.multiTurnDialogue": "多轮对话",
    "homepage.wideCompatibility": "广泛兼容性",
    "homepage.seamlessConversion": "无缝转换",
    "homepage.formatRetention": "格式保留",
    "homepage.multiFormatSupportDescription": "支持多种文件格式，包括.docx、.xlsx、.pptx等，确保与您的Office文档完全兼容。",
    "homepage.seamlessWorkflow": "无缝工作流程",
    "homepage.seamlessWorkflowDescription": "轻松导航和交互您的文档。不再需要在工具之间切换——Chatoffice将AI和Office文档的强大功能结合在一起。",
    "homepage.integratedExperience": "集成体验",
    "homepage.quickNavigation": "快速导航",
    "homepage.autoSave": "自动保存",
    "homepage.highlights": "AIChatOffice 的亮点",
    "homepage.intuitiveAIIntegration": "直观的AI集成",
    "homepage.intuitiveAIIntegrationDescription": "自然地与您的文档对话",
    "homepage.efficientContentExtraction": "高效内容提取",
    "homepage.efficientContentExtractionDescription": "轻松提取关键部分，提升工作效率。",
    "homepage.fastResponse": "快速响应",
    "homepage.fastResponseDescription": "使用高级算法提高处理效率并减少等待时间。",
    "homepage.easeOfUse": "易用性",
    "homepage.easeOfUseDescription": "用户界面简单易用，支持中文和英文。",
    "homepage.transformYourDocumentManagementExperience": "改变您的文档管理体验",
    "homepage.product": "产品",
    "homepage.company": "公司",
    "homepage.resources": "资源",
  },
}

type LanguageContextType = {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: keyof typeof translations.zh) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>("zh")

  const t = (key: keyof typeof translations.en) => {
    return translations[language][key] || key
  }

  return <LanguageContext.Provider value={{ language, setLanguage, t }}>{children}</LanguageContext.Provider>
}

export const useLanguage = () => {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return context
}

