import type React from "react"
import { Link, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  ArrowRight,
  Upload,
  FileType,
  Zap,
  Users,
  Shield,
  Cog,
  Layers,
  FileSearch,
  Clock,
  Sparkles,
  FileText,
  FileSpreadsheet,
  FileImage,
  MessageSquare,
  Brain,
  Lightbulb,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { useFiles } from "@/providers/FileContext"
import documentPreviewImg from '@/assets/document_preview.png'
import aiPoweredImg from '@/assets/ai_powered.png'
import multiFileImg from '@/assets/multi_file.png'
import seamlessWorkflowImg from '@/assets/seamless_workflow.png'
import { useIntl } from "react-intl"
export default function Home() {
  const navigate = useNavigate()
  const { formatMessage: f } = useIntl()
  const { uploadFile } = useFiles()

  const handleGetStarted = () => {
    navigate("/chat/case_word.docx")
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      uploadFile(file)
    }
  }

  return (
    <main className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="px-6 py-16 md:px-20 relative">
        {/* Decorative left border */}
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-pattern-left" />
        {/* Decorative right border */}
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-pattern-right" />
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex justify-center items-center gap-4 mb-6">
            <div className="animate-float-slow">
              <FileText className="h-10 w-10 text-gray-700" />
            </div>
            <div className="animate-float-medium">
              <FileSpreadsheet className="h-10 w-10 text-gray-700" />
            </div>
            <div className="animate-float-fast">
              <FileImage className="h-10 w-10 text-gray-700" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 text-gray-800">
            {f({ id: "homepage.title" })}
          </h1>
          <p className="text-gray-600 text-lg mb-8 max-w-2xl mx-auto">
            {f({ id: "homepage.description" })}
          </p>
          <div className="flex justify-center items-center gap-8 mb-12">
            <div className="flex flex-col items-center">
              <MessageSquare className="h-8 w-8 text-gray-700 mb-2" />
              <span className="text-sm text-gray-600">{f({ id: "homepage.chatInterface" })}</span>
            </div>
            <div className="flex flex-col items-center">
              <Brain className="h-8 w-8 text-gray-700 mb-2" />
              <span className="text-sm text-gray-600">{f({ id: "homepage.aiPowered" })}</span>
            </div>
            <div className="flex flex-col items-center">
              <Lightbulb className="h-8 w-8 text-gray-700 mb-2" />
              <span className="text-sm text-gray-600">{f({ id: "homepage.smartInsights" })}</span>
            </div>
          </div>

          {/* File Upload Area */}
          <div className="relative group light-spot-hover">
            <Input
              type="file"
              className="hidden"
              id="file-upload"
              accept=".pdf,.docx,.xlsx,.pptx"
              onChange={handleFileSelect}
            />
            <label
              htmlFor="file-upload"
              className="block w-full aspect-[16/9] max-w-4xl mx-auto rounded-3xl border-2 border-dashed border-gray-200 hover:border-gray-400 transition-all duration-300 bg-[#e3e6ff59] p-12 cursor-pointer transform hover:scale-[1.01]"
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.classList.add('border-primary');
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.classList.remove('border-primary');
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.classList.remove('border-primary');

                const files = e.dataTransfer.files;
                if (files && files.length > 0) {
                  const fileInput = document.getElementById('file-upload') as HTMLInputElement;
                  if (fileInput) {
                    fileInput.files = files;
                    // 触发change事件
                    const event = new Event('change', { bubbles: true });
                    fileInput.dispatchEvent(event);
                  }
                }
              }}
            >
              <div className="h-full flex flex-col items-center justify-center gap-4">
                <div className="h-16 w-16 rounded-full flex items-center justify-center transform group-hover:scale-110 transition-transform duration-300">
                  <Upload className="h-8 w-8 text-[#6B6CFF]" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-medium mb-2 text-gray-700">{f({ id: "homepage.uploadFiles" })}</p>
                  <p className="text-gray-500 flex items-center justify-center gap-2">
                    <FileType className="h-4 w-4" />
                    {f({ id: "homepage.supportedFiles" })}
                  </p>
                </div>
              </div>
            </label>
          </div>

          <div className="flex gap-4 justify-center mt-8">
            <Button
              size="lg"
              className="transition-all duration-200 transform hover:scale-[1.01] text-white"
              onClick={handleGetStarted}
            >
              {f({ id: "homepage.getStarted" })}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="transition-all duration-200 transform hover:scale-[1.01] text-gray-700"
              onClick={handleGetStarted}
            >
              {f({ id: "homepage.viewDemo" })}
            </Button>
          </div>
        </div>
      </section>

      {/* Brand Wall */}
      <section className="px-6 py-16 md:px-20 border-t border-gray-100">
        <div className="text-center mb-12">
          <p className="text-gray-500">{f({ id: "homepage.featuredOn" })}</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 items-center justify-center">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex justify-center transform hover:scale-105 transition-transform duration-200">
              <div className="w-32 h-12 bg-gray-50 rounded-md" />
            </div>
          ))}
        </div>
      </section>

      {/* Feature Lists */}
      <section className="px-6 py-16 md:px-20 border-t border-gray-100">
        <h2 className="text-3xl font-medium text-center mb-16 text-gray-800">{f({ id: "homepage.powerfulFeatures" })}</h2>

        {/* Feature 1 */}
        <div className="grid lg:grid-cols-2 gap-12 mb-20 items-center">
          <div className="order-2 lg:order-1">
            <h3 className="text-2xl font-medium mb-4 text-gray-800 flex items-center gap-2">
              <Zap className="h-6 w-6 text-gray-700" />
              {f({ id: "homepage.documentPreview" })}
            </h3>
            <p className="text-gray-600 mb-6">
              {f({ id: "homepage.documentPreviewDescription" })}
            </p>
            <ul className="space-y-3">
              {[f({ id: "homepage.multiFormatSupport" }), f({ id: "homepage.intuitiveInterface" }), f({ id: "homepage.fullTextSearch" })].map((feature, i) => (
                <li key={i} className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-gray-700" />
                  <span className="text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="order-1 lg:order-2">
            <img
              src={documentPreviewImg}
              alt="Smart Document Processing"
              width={500}
              height={300}
              className="rounded-lg border border-gray-100"
            />
          </div>
        </div>

        {/* Feature 2 */}
        <div className="grid lg:grid-cols-2 gap-12 mb-20 items-center">
          <div>
            <img
              src={aiPoweredImg}
              alt="Real-time Collaboration"
              width={500}
              height={300}
              className="rounded-lg border border-gray-100"
            />
          </div>
          <div>
            <h3 className="text-2xl font-medium mb-4 text-gray-800 flex items-center gap-2">
              <Users className="h-6 w-6 text-gray-700" />
              {f({ id: "homepage.aiPoweredConversation" })}
            </h3>
            <p className="text-gray-600 mb-6">
              {f({ id: "homepage.aiPoweredConversationDescription" })}
            </p>
            <ul className="space-y-3">
              {[f({ id: "homepage.naturalLanguageProcessing" }), f({ id: "homepage.contextUnderstanding" }), f({ id: "homepage.multiTurnDialogue" })].map((feature, i) => (
                <li key={i} className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-gray-700" />
                  <span className="text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Feature 3 */}
        <div className="grid lg:grid-cols-2 gap-12 mb-20 items-center">
          <div className="order-2 lg:order-1">
            <h3 className="text-2xl font-medium mb-4 text-gray-800 flex items-center gap-2">
              <Shield className="h-6 w-6 text-gray-700" />
              {f({ id: "homepage.multiFormatSupport" })}
            </h3>
            <p className="text-gray-600 mb-6">
              {f({ id: "homepage.multiFormatSupportDescription" })}
            </p>
            <ul className="space-y-3">
              {[f({ id: "homepage.wideCompatibility" }), f({ id: "homepage.seamlessConversion" }), f({ id: "homepage.formatRetention" })].map((feature, i) => (
                <li key={i} className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-gray-700" />
                  <span className="text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="order-1 lg:order-2">
            <img
              src={multiFileImg}
              alt="Advanced Security"
              width={500}
              height={300}
              className="rounded-lg border border-gray-100"
            />
          </div>
        </div>

        {/* Feature 4 */}
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <img
              src={seamlessWorkflowImg}
              alt="Workflow Automation"
              width={500}
              height={300}
              className="rounded-lg border border-gray-100"
            />
          </div>
          <div>
            <h3 className="text-2xl font-medium mb-4 text-gray-800 flex items-center gap-2">
              <Cog className="h-6 w-6 text-gray-700" />
              {f({ id: "homepage.seamlessWorkflow" })}
            </h3>
            <p className="text-gray-600 mb-6">
              {f({ id: "homepage.seamlessWorkflowDescription" })}
            </p>
            <ul className="space-y-3">
              {[f({ id: "homepage.integratedExperience" }), f({ id: "homepage.quickNavigation" }), f({ id: "homepage.autoSave" })].map((feature, i) => (
                <li key={i} className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-gray-700" />
                  <span className="text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Highlights */}
      <section className="px-6 py-16 md:px-20 border-t border-gray-100">
        <h2 className="text-3xl font-medium text-center mb-16 text-gray-800">
          {f({ id: "homepage.highlights" })}
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <HighlightCard
            icon={<Layers className="h-8 w-8 text-gray-700" />}
            title={f({ id: "homepage.intuitiveAIIntegration" })}
            description={f({ id: "homepage.intuitiveAIIntegrationDescription" })}
          />
          <HighlightCard
            icon={<FileSearch className="h-8 w-8 text-gray-700" />}
            title={f({ id: "homepage.efficientContentExtraction" })}
            description={f({ id: "homepage.efficientContentExtractionDescription" })}
          />
          <HighlightCard
            icon={<Zap className="h-8 w-8 text-gray-700" />}
            title={f({ id: "homepage.fastResponse" })}
            description={f({ id: "homepage.fastResponseDescription" })}
          />
          <HighlightCard
            icon={<Clock className="h-8 w-8 text-gray-700" />}
            title={f({ id: "homepage.easeOfUse" })}
            description={f({ id: "homepage.easeOfUseDescription" })}
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-16 md:px-20 border-t border-gray-100">
        <div className="grid md:grid-cols-4 gap-8">
          <div>
            <h3 className="font-medium mb-4 text-gray-800 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-gray-700" />
              AIChatOffice
            </h3>
            <p className="text-gray-500 text-sm">{f({ id: "homepage.transformYourDocumentManagementExperience" })}</p>
          </div>
          {[f({ id: "homepage.product" }), f({ id: "homepage.company" }), f({ id: "homepage.resources" })].map((section) => (
            <div key={section}>
              <h3 className="font-medium mb-4 text-gray-800">{section}</h3>
              <ul className="space-y-2">
                {[1, 2, 3, 4].map((item) => (
                  <li key={item}>
                    <Link to="#" className="text-gray-500 hover:text-gray-700 text-sm transition-colors">
                      Link {item}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </footer>
    </main>
  )
}

function HighlightCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="p-6 rounded-lg bg-white border border-gray-100 transition-all duration-300 hover:scale-[1.01] hover:shadow-md group">
      <div className="mb-4 flex justify-center">{icon}</div>
      <h3 className="font-medium mb-2 text-gray-800 text-center">{title}</h3>
      <p className="text-gray-500 text-sm text-center">{description}</p>
    </div>
  )
}

