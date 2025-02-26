// 检查是否在 Electron 环境中
export const isElectron = () => {
  // @ts-ignore
  return window?.process?.versions?.electron;
};

// 安全地获取 ipcRenderer
export const getIpcRenderer = () => {
  if (isElectron()) {
    return window.require('electron').ipcRenderer;
  }
  return null;
}; 