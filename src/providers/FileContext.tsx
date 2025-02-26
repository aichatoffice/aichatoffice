import type React from "react"
import { useNavigate } from "react-router-dom"
import { createContext, useContext, useState, useEffect } from "react"
import { isElectron, getIpcRenderer } from '../utils/electron'

interface FileItem {
  id: number
  name: string
  create_time: number
}

interface FileContextType {
  files: FileItem[]
  setFiles: (files: FileItem[]) => void
  getFile: () => Promise<void>
  uploadFile: (file: File) => Promise<void>
  deleteFile: (id: number) => Promise<void>
  getPreviewUrl: (id: string) => Promise<string>
  filesLoading: boolean
}

const FileContext = createContext<FileContextType | null>(null)

const apiRequest = async (options: {
  method?: string;
  path: string;
  body?: any;
}) => {
  if (!isElectron() || process.env.NODE_ENV === 'development') {
    // 开发环境或非 Electron 环境使用普通 fetch
    const response = await fetch(options.path, {
      method: options.method,
      body: options.body
    });
    return response.json();
  } else {
    // 生产环境使用 IPC 通信
    const ipcRenderer = getIpcRenderer();
    if (!ipcRenderer) {
      throw new Error('IPC Renderer not available');
    }
    return ipcRenderer.invoke('api-request', options);
  }
};

export function FileProvider({ children }: { children: React.ReactNode }) {
  const [files, setFiles] = useState<FileItem[]>([])
  const [filesLoading, setFilesLoading] = useState<boolean>(false)
  const navigate = useNavigate()

  const getFile = async () => {
    try {
      setFilesLoading(true)
      const data = await apiRequest({
        path: '/showcase/files'
      })
      setFiles(data)
      setFilesLoading(false)
    } catch (error) {
      console.error('Error fetching files:', error)
      setFilesLoading(false)
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

  const deleteFile = async (id: number) => {
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

  const getPreviewUrl = async (id: string) => {
    try {
      return await apiRequest({
        path: `/showcase/${id}/preview/url`
      })
    } catch (error) {
      console.error('Error getting preview url:', error)
    }
  }

  useEffect(() => {
    getFile()
  }, [])

  return <FileContext.Provider value={{ files, setFiles, getFile, uploadFile, deleteFile, getPreviewUrl, filesLoading }}>{children}</FileContext.Provider>
}

export const useFiles = () => {
  const context = useContext(FileContext)
  if (!context) throw new Error("useFiles must be used within FileProvider")
  return context
}

