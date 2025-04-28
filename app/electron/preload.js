const { contextBridge, ipcRenderer } = require('electron')

// 定义允许的通道
const validChannels = ['get-server-url', 'open-auth-window', 'get-store-value', 'set-store-value', 'delete-store-value', 'clear-store']

// 只暴露一个统一的 API 接口
contextBridge.exposeInMainWorld('electron', {
  invoke: (channel, ...args) => {
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args)
    }
    throw new Error(`不允许使用通道 "${channel}"`)
  },
  on: (channel, callback) => {
    ipcRenderer.on(channel, (event, ...args) => callback(...args))
  },
}) 