import type React from "react"
import { useNavigate } from "react-router-dom"
import { createContext, useContext, useState, useEffect } from "react"
import { isElectron, getIpcRenderer } from '../utils/electron'

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
  createFileChat: () => Promise<string>
  getFileById: (id: string) => Promise<FileItem>
  getServerUrl: () => Promise<string>
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
      setFiles(files.filter((file) => file.file_id !== id))
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
  const createFileChat = async () => {
    try {
      const data = await apiRequest({
        path: `/api/chat`,
        method: "POST",
      })
      return data?.data?.conversation_id
    } catch (error) {
      console.error('Error creating chat:', error)
    }
  }

  // 添加一个变量来存储当前活跃的请求ID
  let activeRequestId: string | null = null;

  const sendFileChatMessage = async (
    conversation_id: string,
    message: ChatMessageItem,
    onNewMessage: (chunk: string) => void,
    signal?: AbortSignal
  ) => {
    const processChunk = (chunk: string) => {
      try {
        if (chunk.startsWith('[{')) {
          return;
        }
        if (chunk.startsWith('data: ')) {
          const data = chunk.substring(6);
          onNewMessage(data);
        } else {
          onNewMessage(chunk);
        }
      } catch (e) {
        console.error('Error parsing chunk:', e);
      }
    };

    if (!isElectron()) {
      const response = await apiRequest({
        method: 'POST',
        path: `/api/chatv2/${conversation_id}/chat`,
        body: JSON.stringify(message),
        headers: {
          'Content-Type': 'application/json',
        },
        signal,
        isStream: true
      });

      if (!response.body) throw new Error("No response body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        // 将接收到的chunk按换行符分割，逐行处理
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.trim()) {  // 忽略空行
            processChunk(line);
          }
        }
      }
    } else {
      try {
        const response = await apiRequest({
          method: 'POST',
          path: `/api/chat/${conversation_id}/chat`,
          body: message,
          headers: {
            'Content-Type': 'application/json',
          },
          signal,
          isStream: true
        });

        if (response?.requestId) {
          activeRequestId = response.requestId;
          const ipcRenderer = getIpcRenderer();
          if (!ipcRenderer) {
            throw new Error('IPC renderer not available');
          }

          if (signal) {
            // 监听信号
            signal.addEventListener('abort', async () => {
              if (activeRequestId) {
                try {
                  await ipcRenderer.invoke('cancel-request', activeRequestId);
                  activeRequestId = null;
                } catch (error) {
                  console.error('Error during abort:', error);
                }
              }
            });
          }

          try {
            while (true) {
              const { value, done } = await ipcRenderer.invoke('read-stream', response.requestId);
              if (done) break;
              processChunk(value);
            }
          } catch (error) {
            console.error('Stream reading error:', error);
            throw error;
          }
        }
      } catch (error) {
        console.error('Error in sendFileChatMessage:', error);
        throw error;
      } finally {
        activeRequestId = null;
      }
    }
  };

  const breakFileChat = async (conversationId: string) => {
    if (!isElectron()) {
      const response = await fetch(`/api/chat/${conversationId}/break`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to break chat');
      }
    } else {
      try {
        const ipcRenderer = getIpcRenderer();
        if (ipcRenderer) {
          await ipcRenderer.invoke('break-file-chat', conversationId);
        }
      } catch (error) {
        console.error('Break chat failed:', error);
        throw error;
      }
    }
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
        createFileChat,
        getFileById,
        getServerUrl
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

