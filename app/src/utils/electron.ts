export interface IpcRenderer {
  invoke(channel: string, ...args: any[]): Promise<any>;
}

// 检查是否在 Electron 环境中
export const isElectron = () => {
  // @ts-ignore
  return window?.electron !== undefined;
};

// 安全地获取 ipcRenderer
export const getIpcRenderer = (): IpcRenderer | null => {
  if (isElectron()) {
    // @ts-ignore
    return window.electron;
  }
  return null;
};

export const getUserInfo = async () => {
  const ipcRenderer = getIpcRenderer();
  if (!ipcRenderer) {
    return null
  }
  const userInfo = await ipcRenderer.invoke('get-store-value', 'user')
  return userInfo
};

export const setUserInfo = async (userInfo: any) => {
  const ipcRenderer = getIpcRenderer();
  if (!ipcRenderer) {
    return null
  }
  await ipcRenderer.invoke('set-store-value', 'user', userInfo)
}

export const logout = async () => {
  const ipcRenderer = getIpcRenderer();
  if (!ipcRenderer) {
    return null
  }
  await ipcRenderer.invoke('clear-store')
};