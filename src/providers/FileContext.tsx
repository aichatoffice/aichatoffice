import type React from "react"
import { useNavigate } from "react-router-dom"
import { createContext, useContext, useState, useEffect } from "react"

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

export function FileProvider({ children }: { children: React.ReactNode }) {
  const [files, setFiles] = useState<FileItem[]>([])
  const [filesLoading, setFilesLoading] = useState<boolean>(false)
  const navigate = useNavigate()

  const getFile = async () => {
    try {
      setFilesLoading(true)
      const response = await fetch('/showcase/files')
      const data = await response.json()
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
      const response = await fetch('/showcase/file', {
        method: 'POST',
        body: formData
      })
      getFile()
      const data = await response.json()
      navigate(`/chat/${data.id}`)
    } catch (error) {
      console.error('Error uploading file:', error)
    }
  }

  const deleteFile = async (id: number) => {
    try {
      await fetch(`/showcase/file/${id}`, {
        method: 'DELETE'
      })
      setFiles(files.filter((file) => file.id !== id))
      navigate('/')
    } catch (error) {
      console.error('Error deleting file:', error)
    }
  }

  const getPreviewUrl = async (id: string) => {
    try {
      const response = await fetch(`/showcase/${id}/preview/url`)
      const data = await response.json()
      return data
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

