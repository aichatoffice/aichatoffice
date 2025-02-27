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