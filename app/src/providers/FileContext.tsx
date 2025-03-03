import type React from "react"
import { useNavigate } from "react-router-dom"
import { createContext, useContext, useState, useEffect } from "react"
import { isElectron, getIpcRenderer } from '../utils/electron'

interface FileItem {
  id: number
  name: string
  type: string
  content: string
  create_time: number
}

interface ChatMessageItem {
  stream: boolean
  content: {
    type: string
    text: string
  }[]
}

interface FileContextType {
  files: FileItem[]
  setFiles: (files: FileItem[]) => void
  getFile: () => Promise<void>
  uploadFile: (file: File) => Promise<void>
  deleteFile: (id: number) => Promise<void>
  getPreviewUrl: (id: string) => Promise<string>
  filesLoading: boolean
  sendFileChatMessage: (
    conversation_id: string,
    message: ChatMessageItem,
    onNewMessage: (chunk: string) => void,
    signal?: AbortSignal
  ) => Promise<void>
  createFileChat: () => Promise<string>
  breakFileChat: (conversation_id: string) => Promise<void>
  getFileById: (id: string) => Promise<FileItem>
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
  if (!isElectron()) {
    // 非 Electron 环境使用普通 fetch
    const response = await fetch(options.path, {
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
  } else {
    // Electron 环境使用 IPC 通信
    const ipcRenderer = getIpcRenderer();
    if (!ipcRenderer) {
      throw new Error('IPC renderer not available');
    }
    // 添加一个标志来标识 FormData
    const isFormData = options.body instanceof FormData;

    // 如果是 FormData，将其转换为对象
    let processedBody = options.body;
    if (isFormData) {
      processedBody = {
        _isFormData: true,
        entries: await Promise.all(
          Array.from(options.body.entries() as IterableIterator<[string, any]>).map(async ([key, value]) => {
            if (value instanceof File) {
              const content = await new Promise((resolve) => {
                const reader = new FileReader()
                reader.onload = () => resolve(reader.result)
                reader.readAsDataURL(value)
              })
              return [
                key,
                {
                  _isFile: true,
                  name: value.name,
                  type: value.type,
                  lastModified: value.lastModified,
                  size: value.size,
                  content,
                },
              ]
            }
            return [key, value]
          }),
        ),
      }
    }

    const result = await ipcRenderer.invoke('api-request', {
      method: options.method || 'GET',
      path: options.path,
      body: processedBody,
      headers: options.headers,
      isStream: isStream
    });
    // 处理流式响应
    if (result?.requestId && isStream) {
      return { response: result.response, requestId: result.requestId };
    }

    return result;
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
        path: `/api/chat/${conversation_id}/chat`,
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
        sendFileChatMessage,
        createFileChat,
        breakFileChat,
        getFileById
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

