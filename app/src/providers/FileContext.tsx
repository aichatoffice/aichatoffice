import type React from "react"
import { useNavigate } from "react-router-dom"
import { createContext, useContext, useState, useEffect } from "react"
import { isElectron, getIpcRenderer } from '../utils/electron'
import { toast } from "sonner"

interface FileItem {
  id: string
  file_id: string
  name: string
  type: string
  content: string
  create_time: number
}
interface FileContextType {
  files: FileItem[]
  setFiles: (files: FileItem[]) => void
  getFile: () => Promise<void>
  uploadFile: (file: File) => Promise<void>
  deleteFile: (id: string) => Promise<void>
  getPreviewUrl: (id: string) => Promise<string>
  filesLoading: boolean
  getFileById: (id: string) => Promise<FileItem>
  getServerUrl: () => Promise<string>
  getConversation: (fileId: string) => Promise<any>
  getAiConfig: () => Promise<any>
  updateAiConfig: (aiConfig: any) => Promise<any>
}

const FileContext = createContext<FileContextType | null>(null)

const apiRequest = async (options: {
  method?: string;
  path: string;
  body?: any;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  isStream?: boolean;
}) => {
  const isStream = options.isStream
  let path = options.path
  if (isElectron()) {
    const ipcRenderer = getIpcRenderer();
    if (!ipcRenderer) {
      throw new Error('IPC renderer not available');
    }
    const prefix = await ipcRenderer.invoke('get-server-url')
    path = `${prefix}${path}`
  }
  const response = await fetch(path, {
    method: options.method,
    body: options.body,
    headers: options.headers,
    signal: options.signal,
  })
  const ok = response.status >= 200 && response.status < 300
  if (!ok) {
    const error = await response.json()
    toast.error(JSON.stringify(error))
    throw new Error(error.message)
  }
  // 如果 response 是 stream，则返回 stream
  if (isStream || response.status == 204) {
    return response
  } else {
    return response.json()
  }
};

export function FileProvider({ children }: { children: React.ReactNode }) {
  const [files, setFiles] = useState<FileItem[]>([])
  const [filesLoading, setFilesLoading] = useState<boolean>(false)
  const navigate = useNavigate()

  const getServerUrl = async () => {
    if (isElectron()) {
      const ipcRenderer = getIpcRenderer();
      if (!ipcRenderer) {
        throw new Error('IPC renderer not available');
      }
      const result = await ipcRenderer.invoke('get-server-url')
      return result
    }
    return window.location.origin
  }

  const getFile = async () => {
    try {
      setFilesLoading(true)
      const data = await apiRequest({
        path: '/showcase/files'
      })
      setFiles(data ? data : [])
      setFilesLoading(false)
    } catch (error) {
      console.error('Error fetching files:', error)
      setFilesLoading(false)
    }
  }

  const getFileById = async (id: string) => {
    try {
      const data = await apiRequest({
        path: `/showcase/files/${id}`
      })
      return data
    } catch (error) {
      // navigate('/')
      console.error('Error fetching files:', error)
    }
  }

  const uploadFile = async (file: File) => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      const data = await apiRequest({
        method: 'POST',
        path: '/showcase/file',
        body: formData
      })
      getFile()
      navigate(`/chat/${data.id}`)
    } catch (error) {
      console.error('Error uploading file:', error)
    }
  }

  const deleteFile = async (id: string) => {
    try {
      await apiRequest({
        method: 'DELETE',
        path: `/showcase/file/${id}`
      })
      setFiles(files.filter((file) => file.id !== id))
      navigate('/')
    } catch (error) {
      console.error('Error deleting file:', error)
    }
  }

  const getPreviewUrl = async (id: string): Promise<string> => {
    try {
      const data = await apiRequest({
        path: `/showcase/${id}/preview/url`
      })
      return data?.url
    } catch (error) {
      console.error('Error getting preview url:', error)
      return ""
    }
  }

  const getConversation = async (fileId: string) => {
    try {
      const data = await apiRequest({
        path: `/api/chat/${fileId}/conversation`,
      })
      return data
    } catch (error) {
      console.error('Error getting conversation:', error)
    }
  }

  const getAiConfig = async () => {
    const data = await apiRequest({
      path: `/api/ai/config`,
    })
    return data
  }

  const updateAiConfig = async (aiConfig: any) => {
    const data = await apiRequest({
      method: 'POST',
      path: `/api/ai/config`,
      body: JSON.stringify(aiConfig),
    })
    return data
  }

  useEffect(() => {
    getFile()
  }, [])

  return (
    <FileContext.Provider
      value={{
        files,
        setFiles,
        getFile,
        uploadFile,
        deleteFile,
        getPreviewUrl,
        filesLoading,
        getFileById,
        getServerUrl,
        getConversation,
        getAiConfig,
        updateAiConfig,
      }}
    >
      {children}
    </FileContext.Provider>
  )
}

export const useFiles = () => {
  const context = useContext(FileContext)
  if (!context) throw new Error("useFiles must be used within FileProvider")
  return context
}

