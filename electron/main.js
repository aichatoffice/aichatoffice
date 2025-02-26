import { app, BrowserWindow, screen, ipcMain } from 'electron'
import path from 'node:path'
import fs from "fs";
import remote from "@electron/remote/main/index.js";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow
const appDir = path.dirname(app.getAppPath());
const confDir = path.join(app.getPath("home"), ".config", "aichatoffice");
const windowStatePath = path.join(confDir, "windowState.json");
const isDevelopment = process.env.NODE_ENV === 'development';
// 初始化window
let bootWindow;
let openAsHidden = false;
let workspaces = []; // workspaceDir, id, browserWindow, tray, hideShortcut

remote.initialize();

const API_BASE_URL = 'https://turbo-demo.shimorelease.com';

const isOpenAsHidden = function () {
  return 1 === workspaces.length && openAsHidden;
};

// 添加 IPC 处理器
const setupIPCHandlers = () => {
  ipcMain.handle('api-request', async (event, options) => {
    try {
      const { method = 'GET', path, body } = options;
      const url = `${API_BASE_URL}${path}`;

      const fetchOptions = {
        method,
        headers: {
          'Origin': API_BASE_URL
        }
      };

      if (body) {
        if (body instanceof FormData) {
          fetchOptions.body = body;
        } else {
          fetchOptions.body = JSON.stringify(body);
          fetchOptions.headers['Content-Type'] = 'application/json';
        }
      }

      const response = await fetch(url, fetchOptions);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  });
};

app.whenReady().then(() => {
  setupIPCHandlers();
  initMainWindow();
})

const initMainWindow = () => {
  console.log("initMainWindow");
  // 恢复主窗体状态
  let oldWindowState = {};
  try {
    oldWindowState = JSON.parse(fs.readFileSync(windowStatePath, "utf8"));
  } catch (e) {
    fs.writeFileSync(windowStatePath, "{}");
  }
  let defaultWidth;
  let defaultHeight;
  let workArea;
  try {
    defaultWidth = Math.floor(screen.getPrimaryDisplay().size.width * 0.8);
    defaultHeight = Math.floor(screen.getPrimaryDisplay().workAreaSize.height * 0.9);
    workArea = screen.getPrimaryDisplay().workArea;
  } catch (e) {
    console.error(e);
  }
  const windowState = Object.assign({}, {
    isMaximized: false,
    fullscreen: false,
    isDevToolsOpened: false,
    x: 0,
    y: 0,
    width: defaultWidth,
    height: defaultHeight,
  }, oldWindowState);

  writeLog("windowStat [x=" + windowState.x + ", y=" + windowState.y + ", width=" + windowState.width + ", height=" + windowState.height + "], default [width=" + defaultWidth + ", height=" + defaultHeight + "], workArea [width=" + workArea.width + ", height=" + workArea.height + "]");

  let resetToCenter = false;
  let x = windowState.x;
  let y = windowState.y;
  if (workArea) {
    // 窗口大于 workArea 时缩小会隐藏到左下角，这里使用最小值重置
    if (windowState.width > workArea.width || windowState.height > workArea.height) { // 重启后窗口大小恢复默认问题 https://github.com/siyuan-note/siyuan/issues/7755
      windowState.width = Math.min(defaultWidth, workArea.width);
      windowState.height = Math.min(defaultHeight, workArea.height);
    }

    if (x >= workArea.width * 0.8 || y >= workArea.height * 0.9) {
      resetToCenter = true;
    }
  }

  if (x < 0 || y < 0) {
    resetToCenter = true;
  }

  if (windowState.width < 493) {
    windowState.width = 493;
  }
  if (windowState.height < 376) {
    windowState.height = 376;
  }

  mainWindow = new BrowserWindow({
    show: false,
    width: windowState.width,
    height: windowState.height,
    minWidth: 493,
    minHeight: 376,
    fullscreenable: true,
    fullscreen: windowState.fullscreen,
    trafficLightPosition: { x: 8, y: 8 },
    webPreferences: {
      nodeIntegration: true,
      webviewTag: true,
      webSecurity: false,
      contextIsolation: false,
      autoplayPolicy: "user-gesture-required",
      devTools: true
    },
    icon: path.join(appDir, "stage", "icon-large.png"),
  });
  remote.enable(mainWindow.webContents);
  if (resetToCenter) {
    mainWindow.center();
  } else {
    mainWindow.setPosition(x, y);
  }
  // 主界面事件监听
  mainWindow.once("ready-to-show", () => {
    console.log("ready-to-show");
    if (isOpenAsHidden()) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
      if (windowState.isMaximized) {
        mainWindow.maximize();
      } else {
        mainWindow.unmaximize();
      }
    }
    if (bootWindow && !bootWindow.isDestroyed()) {
      bootWindow.destroy();
    }
  });

  if (isDevelopment) {
    console.log("isDevelopment");
    const waitDevServer = async () => {
      try {
        await mainWindow.loadURL('http://localhost:5173');
        console.log('开发服务器加载成功');
        // 在开发环境下打开开发者工具
        mainWindow.webContents.openDevTools();
      } catch (error) {
        console.log('等待开发服务器启动...', error.message);
        if (global.retryCount === undefined) {
          global.retryCount = 0;
        }
        if (global.retryCount < 30) {
          global.retryCount++;
          setTimeout(waitDevServer, 1000);
        } else {
          console.error('开发服务器启动失败，请检查 vite 配置');
          app.quit();
        }
      }
    };
    waitDevServer().catch(error => {
      console.error('开发服务器加载错误:', error);
      app.quit();
    });
  } else {
    const indexPath = path.join(process.resourcesPath, 'dist/index.html');
    console.log('Loading production path:', indexPath);
    mainWindow.loadFile(indexPath).catch((error) => {
      writeLog("load main index failed: " + error);
      console.error('加载页面失败:', error);
    });
  }

  mainWindow.on("close", (event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("secretnote-save-close", false);
    }
    // event.preventDefault();
  });

  // 添加以下代码来帮助调试
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.log('页面加载失败:', errorCode, errorDescription);
    writeLog(`页面加载失败: ${errorCode} ${errorDescription}`);
  });
}

const writeLog = (out) => {
  console.log(out);
  const logFile = path.join(confDir, "app.log");
  let log = "";
  const maxLogLines = 1024;
  try {
    if (fs.existsSync(logFile)) {
      log = fs.readFileSync(logFile).toString();
      let lines = log.split("\n");
      if (maxLogLines < lines.length) {
        log = lines.slice(maxLogLines / 2, maxLogLines).join("\n") + "\n";
      }
    }
    out = out.toString();
    out = new Date().toISOString().replace(/T/, " ").replace(/\..+/, "") + " " + out;
    log += out + "\n";
    fs.writeFileSync(logFile, log);
  } catch (e) {
    console.error(e);
  }
};