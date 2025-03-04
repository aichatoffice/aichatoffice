import { app, protocol, net, BrowserWindow, screen, ipcMain } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import url from 'node:url'
import fs from 'node:fs'
import gNet from 'net'
import cp from 'child_process'
import remote from '@electron/remote/main/index.js'

// ES模块中 __dirname 的替代方案
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow
const appDir = path.dirname(app.getAppPath())
const isDevEnv = process.env.NODE_ENV === "development"
const appVer = app.getVersion()
let kernelPort = 0 // 本地调试时需要修改为本地后服务端口
let kernelSDKPort = 0
let governorApiPort = 0
let grpcPort = 0

const confDir = path.join(app.getPath("home"), ".config", "aichatoffice")
const windowStatePath = path.join(confDir, "windowState.json")
let kernelProcess
let kernelSDKProcess
let bootWindow
let openAsHidden = false
let workspaces = []
remote.initialize()

// 添加新的变量来追踪 dock 点击事件
let isQuitting = false;

const isOpenAsHidden = function () {
  return 1 === workspaces.length && openAsHidden;
};

try {
  if (!fs.existsSync(confDir)) {
    fs.mkdirSync(confDir, { mode: 0o755, recursive: true });
  }
} catch (e) {
  console.error(e);
  require("electron").dialog.showErrorBox("创建配置目录失败 Failed to create config directory", "需要在用户家目录下创建配置文件夹（~/.config/aichatoffice），请确保该路径具有写入权限。\n\n needs to create a configuration folder (~/.config/aichatoffice) in the user's home directory. Please make sure that the path has write permissions.");
  app.exit();
}

// 存储 AbortController 的映射
const abortControllers = new Map();

// 添加一个 Map 来跟踪每个会话的活动请求
const activeConversationRequests = new Map();

// 生成唯一的请求ID
function generateRequestId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 处理请求
ipcMain.handle('api-request', async (event, options) => {
  const { method = 'GET', path, body, headers = {}, isStream = false } = options;
  const url = `${localServer}:${kernelPort}${path}`;
  const requestId = generateRequestId();

  // 检查是否是聊天请求
  const chatMatch = path.match(/\/api\/chat\/(.*?)\/chat/);
  const conversationId = chatMatch ? chatMatch[1] : null;

  const requestInfo = {
    controller: new AbortController(),
    response: null,
  };
  abortControllers.set(requestId, requestInfo);

  // 如果是聊天请求，记录到会话Map中
  if (conversationId) {
    activeConversationRequests.set(conversationId, requestInfo);
  }

  writeLog(`API request: ${method} ${path} (ID: ${requestId})`);

  try {
    let requestBody;

    if (body && body._isFormData) {
      writeLog('Reconstructing FormData');
      const formData = new FormData();

      // 检查并处理entries数组
      if (Array.isArray(body.entries)) {
        for (const [key, value] of body.entries) {
          if (value && value._isFile) {
            // 从base64重建文件
            try {
              const base64Data = value.content.split(',')[1];
              const buffer = Buffer.from(base64Data, 'base64');
              const blob = new Blob([buffer], { type: value.type });
              const file = new File([blob], value.name, {
                type: value.type,
                lastModified: value.lastModified
              });
              formData.append(key, file);
              writeLog(`Added file to FormData: ${key}, ${value.name}, ${value.type}`);
            } catch (error) {
              writeLog(`Error creating file from base64: ${error.message}`);
              throw new Error(`Failed to process file: ${error.message}`);
            }
          } else {
            formData.append(key, value);
            writeLog(`Added field to FormData: ${key}`);
          }
        }
      }
      requestBody = formData;
      writeLog('FormData reconstruction completed');
    } else if (body) {
      if (headers['Content-Type'] == "") {
        headers['Content-Type'] = 'application/json';
      }
      requestBody = JSON.stringify(body);
      writeLog(`Request body: ${requestBody}`);
    }
    console.log('formbody')
    if (isStream) {
      const response = await fetch(url, {
        method,
        body: requestBody,
        headers,
        signal: requestInfo.controller.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        writeLog(`API request failed: ${response.status} ${response.statusText}, Error: ${errorText}`);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      requestInfo.response = response; // 保存响应对象以供后续读取

      return {
        requestId,
        response: {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          isStream: true
        }
      };
    } else {
      const response = await fetch(url, {
        method,
        body: requestBody,
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        writeLog(`API request failed: ${response.status} ${response.statusText}, Error: ${errorText}`);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }
      // 如果是流式响应，直接读取并返回数据
      if (isStream) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        // 返回一个可序列化的对象，包含状态码和头信息
        return {
          requestId,
          response: {
            status: response.status,
            headers: Object.fromEntries(response.headers.entries()),
            // 不直接返回 body，而是返回一个标识
            isStream: true
          }
        };
      } else {
        if (response.status == 204) {
          return response
        } else {
          const data = await response.json();
          writeLog(`API response: ${JSON.stringify(data)}`);
          return data;
        }
      }
    }
  } catch (error) {
    writeLog(`API request failed: ${error.message}, URL: ${url}`);
    throw error;
  } finally {
    if (!isStream) {
      abortControllers.delete(requestId);
      if (conversationId) {
        activeConversationRequests.delete(conversationId);
      }
    }
  }
});

// 处理请求取消
ipcMain.handle('cancel-request', (event, requestId) => {
  const controller = abortControllers.get(requestId);
  if (controller) {
    writeLog(`Cancelling request: ${requestId}`);
    controller.abort();
    abortControllers.delete(requestId);
    return true;
  }
  return false;
});

// 处理中断聊天请求
ipcMain.handle('break-file-chat', async (event, conversationId) => {
  const url = `${localServer}:${kernelPort}/api/chat/${conversationId}/break`;
  writeLog(`Breaking chat for conversation: ${conversationId}`);

  try {
    // 首先中断该会话的活动请求
    const activeRequest = activeConversationRequests.get(conversationId);
    if (activeRequest?.controller) {
      writeLog(`Aborting active request for conversation: ${conversationId}`);
      activeRequest.controller.abort();
      activeConversationRequests.delete(conversationId);
    }

    // 然后发送 break 请求
    const response = await fetch(url, {
      method: 'POST',
    });

    if (!response.ok) {
      const errorText = await response.text();
      writeLog(`Break chat failed: ${response.status} ${response.statusText}, Error: ${errorText}`);
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    writeLog(`Chat break successful for conversation: ${conversationId}`);
    return true;
  } catch (error) {
    writeLog(`Break chat failed: ${error.message}`);
    throw error;
  }
});

// 添加新的 IPC 处理器来处理流数据
const streamReaders = new Map();

ipcMain.handle('read-stream', async (event, requestId) => {
  const requestInfo = abortControllers.get(requestId);
  if (!requestInfo?.response?.body) {
    throw new Error('Stream not found');
  }

  let reader = streamReaders.get(requestId);
  if (!reader) {
    reader = requestInfo.response.body.getReader();
    streamReaders.set(requestId, reader);
  }

  const decoder = new TextDecoder();

  try {
    const { value, done } = await reader.read();
    if (done) {
      reader.releaseLock();
      streamReaders.delete(requestId);
      abortControllers.delete(requestId);
      const requestInfo = abortControllers.get(requestId);
      if (requestInfo?.conversationId) {
        activeConversationRequests.delete(requestInfo.conversationId);
      }
      return { done };
    }
    return {
      value: decoder.decode(value),
      done
    };
  } catch (error) {
    reader.releaseLock();
    streamReaders.delete(requestId);
    abortControllers.delete(requestId);
    throw error;
  }
});

app.whenReady().then(() => {
  writeLog("start server: " + appDir);
  writeLog("start server dirname: " + __dirname);

  // 添加 dock 点击事件处理
  app.on('activate', () => {
    if (mainWindow === null) {
      initMainWindow()
    } else {
      mainWindow.show()
    }
  })

  runServer().then((result) => {
    writeLog("runServer result: " + result);
    if (result) {
      writeLog('runServer success')
      initMainWindow()
    } else {
      writeLog('runServer failed')
    }
  })
})

async function runServer() {
  try {
    // 初始化启动窗口
    bootWindow = await initBootWindow();

    // 获取服务路径
    const { serverPath, sdkServerPath } = getServerPaths();

    // 检查服务程序是否存在
    if (!isDevEnv && !checkServerExecutables(serverPath, sdkServerPath)) {
      return false;
    }

    // 获取可用端口
    if (!await initializePorts()) {
      return false;
    }

    // 生成配置文件
    const configPath = generateRuntimeConfig();
    const sdkConfigPath = generateSDKRuntimeConfig();

    // 准备启动命令
    const cmds = ["--config=" + configPath, "server"];
    const sdkCmds = ["--config=" + sdkConfigPath, "api", "--local-callback-addr=" + getServer()];

    writeLog(`---------------------> "--local-callback-addr=" + ${getServer()}`)

    writeLog(`booting kernel [${serverPath} ${cmds.join(" ")}]`);
    writeLog(`booting sdk [${sdkServerPath} ${sdkCmds.join(" ")}]`);

    // 启动服务
    if (!isDevEnv || workspaces.length > 0) {
      // 启动主服务
      if (!await startKernelServer(serverPath, cmds)) {
        return false;
      }
      // await sleep(2000);
      // 启动 SDK 服务
      if (!await startSDKServer(sdkServerPath, sdkCmds)) {
        return false;
      }
    }

    return true;
  } catch (error) {
    writeLog(`Server startup failed: ${error.message}`);
    bootWindow?.destroy();
    return false;
  }
}

// 辅助函数
async function initBootWindow() {
  const bootWindow = new BrowserWindow({
    show: false,
    width: Math.floor(screen.getPrimaryDisplay().size.width / 2),
    height: Math.floor(screen.getPrimaryDisplay().workAreaSize.height / 2),
    frame: false,
    backgroundColor: "#1e1e1e",
    resizable: false,
    icon: path.join(appDir, "stage", "icon-large.png"),
  });

  const bootIndex = isDevEnv
    ? path.join(appDir, "electron", "boot.html")
    : path.join(process.resourcesPath, "electron", "boot.html");

  await bootWindow.loadFile(bootIndex, { query: { v: appVer } });

  if (openAsHidden) {
    bootWindow.minimize();
  } else {
    bootWindow.show();
  }

  return bootWindow;
}

function getServerPaths() {
  const basePath = isDevEnv ? path.join(appDir, "electron", "server") : path.join(process.resourcesPath, "electron", "server");
  return {
    serverPath: path.join(basePath, 'aichatoffice'),
    sdkServerPath: path.join(basePath, 'sdk', 'turboone')
  };
}

function checkServerExecutables(serverPath, sdkServerPath) {
  if (!fs.existsSync(serverPath)) {
    showErrorWindow("⚠️ 内核程序丢失 Kernel program is missing",
      `<div>内核程序丢失，请重新安装 AIChatOffice ，并将 AIChatOffice 内核程序加入杀毒软件信任列表。</div><div>The kernel program is not found, please reinstall AIChatOffice and add AIChatOffice Kernel prgram into the trust list of your antivirus software.</div><div><i>${serverPath}</i></div>`);
    bootWindow.destroy();
    return false;
  }

  if (!fs.existsSync(sdkServerPath)) {
    showErrorWindow("⚠️ 极速版sdk程序丢失 TurboOne program is missing",
      `<div>极速版sdk程序丢失，请重新安装 AIChatOffice ，并将 AIChatOffice 极速版sdk程序加入杀毒软件信任列表。</div><div>The TurboOne program is not found, please reinstall AIChatOffice and add AIChatOffice TurboOne program into the trust list of your antivirus software.</div><div><i>${sdkServerPath}</i></div>`);
    bootWindow.destroy();
    return false;
  }

  return true;
}

async function startSDKServer(sdkServerPath, sdkCmds) {
  kernelSDKProcess = cp.spawn(sdkServerPath, sdkCmds, {
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const isSDKStarted = await waitForServerReady(kernelSDKProcess, 'SDK');
  if (!isSDKStarted) return false;

  await sleep(1000);

  const currentKernelSDKPort = kernelSDKPort;
  writeLog(`booted sdk process [pid=${kernelSDKProcess.pid}, port=${currentKernelSDKPort}]`);

  kernelSDKProcess.on("close", handleSDKProcessClose);

  // 检查 SDK 服务端口
  if (!await checkServiceEndpoint(getSDKerver() + "/api/file/page", "SDK")) {
    return false;
  }

  return true;
}

async function startKernelServer(serverPath, cmds) {
  kernelProcess = cp.spawn(serverPath, cmds, {
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const isKernelStarted = await waitForServerReady(kernelProcess, 'kernel');
  if (!isKernelStarted) return false;

  await sleep(1000);

  const currentKernelPort = kernelPort;
  writeLog(`booted kernel process [pid=${kernelProcess.pid}, port=${kernelPort}]`);

  kernelProcess.on("close", (code) => handleKernelProcessClose(code, currentKernelPort));

  // 检查主服务端口 (AI 回调 不通过会导致SDK启动失败)
  if (!await checkServiceEndpoint(getServer() + "/v1/callback/chat/aiConfig", "kernel")) {
    return false;
  }

  return true;
}

const initMainWindow = () => {
  protocol.handle('atom', (request) => {
    const filePath = request.url.slice('atom://'.length)
    return net.fetch(url.pathToFileURL(path.join(__dirname, filePath)).toString())
  })

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
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      autoplayPolicy: "user-gesture-required",
      devTools: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
      additionalArguments: [`--js-flags=--max-old-space-size=8192`],
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

  if (isDevEnv) {
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
    // 在 macOS 上，点击红色关闭按钮时只隐藏窗口
    if (process.platform === 'darwin' && !isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return;
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("AIChatOffice-save-close", false);
    }
  });

  // 添加以下代码来帮助调试
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.log('页面加载失败:', errorCode, errorDescription);
    writeLog(`页面加载失败: ${errorCode} ${errorDescription}`);
  });
}

const showErrorWindow = (title, content) => {
  let errorHTMLPath
  if (isDevEnv) {
    errorHTMLPath = path.join(appDir, "electron", "error.html");
  } else {
    errorHTMLPath = path.join(process.resourcesPath, "electron", "error.html");
  }
  const errWindow = new BrowserWindow({
    width: Math.floor(screen.getPrimaryDisplay().size.width * 0.5),
    height: Math.floor(screen.getPrimaryDisplay().workAreaSize.height * 0.8),
    // frame: false,
    icon: path.join(appDir, "stage", "icon-large.png"),
    webPreferences: {
      nodeIntegration: true,
      webviewTag: true,
      webSecurity: false,
      contextIsolation: false,
    },
  });
  errWindow.loadFile(errorHTMLPath, {
    query: {
      home: app.getPath("home"),
      v: appVer,
      title: title,
      content: content,
      icon: path.join(appDir, "stage", "icon-large.png"),
    },
  });
  errWindow.show();
  return errWindow.id;
};


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

// 生成运行时 客户客户端配置文件
function generateRuntimeConfig() {
  // 创建配置文件目录
  const configDir = path.join(confDir, "config");
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  // 创建日志目录
  const logsDir = path.join(confDir, "logs");
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // 生成运行时配置文件内容
  const runtimeConfig =
    `
[server]
host = "127.0.0.1"
port = ${kernelPort}
enableAccessInterceptor = true
enableAccessInterceptorRes = true
embedPath = "dist"

[logger]
# dir = "${logsDir}"
writer = "stdout"

[leveldb]
path = "${path.join(confDir, "leveldbstore")}"

[host]
downloadUrlPrefix = "${localServer}:${kernelPort}"
previewUrlPrefix = "${localServer}:${kernelSDKPort}"

[case]
resourcePath = "${isDevEnv ? "./resource" : path.join(process.resourcesPath, "electron", "resource")}"

[userChat]
reset = ["/reset"]
timeout = 300
# conversationLimit = 5
convertedTextDir = "converted"

[openai]
configMode = "local"                                         # local 本地配置，remote 远程回调配置
baseUrl = "https://api.siliconflow.cn/v1"
textModel = "deepseek-ai/DeepSeek-R1-Distill-Llama-8B"
token = "sk-xisjdsqkpwdypklaubsigiewuoxrkctrfynieiqwgxfetgtz"
name = ""
proxyUrl = ""
subservice = ""
inputMaxToken = 1000
outputMaxToken = 10000
`

  // 将配置写入文件
  const configPath = path.join(configDir, "config.toml");
  fs.writeFileSync(configPath, runtimeConfig);
  writeLog("Config file written to: " + configPath);
  writeLog("Config content: " + runtimeConfig);  // 添加日志以便调试

  return configPath
}

// 生成运行时 客户客户端配置文件
function generateSDKRuntimeConfig() {
  // 创建配置文件目录
  const configDir = path.join(confDir, "SDKconfig");
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  // 创建cdn文件目录
  const cdnDir = path.join(confDir, "cdn");
  if (!fs.existsSync(cdnDir)) {
    fs.mkdirSync(cdnDir, { recursive: true });
  }
  // 生成运行时配置文件内容
  const runtimeConfig =
    `
[app]
rootURL = "http://localhost:${kernelSDKPort}"
cdnDir = "${cdnDir}"

[server.http.api]
network = "tcp4"
host = "127.0.0.1"
port = ${kernelSDKPort}
embedPath = "dist"

[server.governor.api]
host = "127.0.0.1"
port = ${governorApiPort}

[server.grpc]
port = ${grpcPort}
maxRecvMsgSize = 300
maxSendMsgSize = 10

[logger.default]
level = "debug"
writer = "stdout"

[logger.ego]
level = "info"
writer = "stdout"

[preview]
fileValidDays = 7
totalFileSizeLimitBytes = 100
fileDir = "${path.join(cdnDir, "files")}"
fileReplaceExts = [".emf", ".wmf", ".chart", ".tif", ".tiff"]

[preview.static.rule]
lizard-service-preview = ["assets", "templates", "service.scripts", "service.styles"]
lizard-service-docx-sdk = ["assets", "service.scripts", "service.styles"]
lizard-service-presentation-sdk = ["assets", "service.scripts", "service.styles"]
lizard-service-sheet-sdk = ["assets", "service.scripts", "service.styles"]

[preview.convert]
tmpDir = "${path.join(confDir, "tmp")}"

[preview.watermark.copyright]
enable = true

[apiStore]
storeType = "leveldb"

[apiStore.leveldb]
path = "${path.join(confDir, "apileveldb")}"

[chatStore]
storeType = "leveldb" 

[chatStore.leveldb]
path = "${path.join(confDir, "chatleveldb")}"

[callback]
configFileName = "${isDevEnv ? "./server/sdk/callback.yaml" : path.join(process.resourcesPath, "electron", "server", "sdk", "callback.yaml")}"
timeoutSec = 5
uploadTimeoutSec = 600
retryAttempts = 3
retryDelaySec = 1

[stream]
apiConfigFileName = "${isDevEnv ? "./server/sdk/api.yaml" : path.join(process.resourcesPath, "electron", "server", "sdk", "api.yaml")}"

[license]
fileSizeLimit = "1M"
checkGRPCTimeout = "5s"

[jwt]
secretKey = "i4?h_c@UGbPK_RRgf+7buu]MYbgh9~=Z"

[font]
dir = "${path.join(cdnDir, "fonts")}"
validMimeTypes = ["font/ttf", "font/woff"] 

# 下面都是 ai 用的
[userChat]
reset = ["/reset"]
timeout = 300


[openai]
configMode = "local"  # local 本地配置，remote 远程回调配置
`
  // 将配置写入文件
  const configPath = path.join(configDir, "config.toml");
  fs.writeFileSync(configPath, runtimeConfig);
  writeLog("Config file written to: " + configPath);
  writeLog("Config content: " + runtimeConfig);  // 添加日志以便调试

  return configPath
}

const localServer = "http://127.0.0.1";

const getServer = (port = kernelPort) => {
  return localServer + ":" + port;
};

const getSDKerver = (port = kernelSDKPort) => {
  return localServer + ":" + port;
};

const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

async function initializePorts() {
  // 非开发环境或有工作空间时才需要初始化端口
  if (!(!isDevEnv || workspaces.length > 0)) {
    return true;
  }

  try {
    // 获取 SDK 服务端口
    if (!kernelSDKPort) {
      kernelSDKPort = await getAvailablePort("sdk");
      writeLog(`got kernel sdk port [${kernelSDKPort}]`);
    }
    // 获取客户端服务端口
    if (!kernelPort) {
      kernelPort = await getAvailablePort("client");
      writeLog(`got kernel port [${kernelPort}]`);
    }
    // 获取 governor api 端口
    if (!governorApiPort) {
      governorApiPort = await getAvailablePort("governorApi");
      writeLog(`got governor api port [${governorApiPort}]`);
    }
    // 获取 grpc 端口 
    if (!grpcPort) {
      grpcPort = await getAvailablePort("grpc");
      writeLog(`got grpc port [${grpcPort}]`);
    }

    if (!kernelPort || !kernelSDKPort) {
      bootWindow.destroy();
      return false;
    }

    return true;
  } catch (error) {
    writeLog(`Failed to initialize ports: ${error.message}`);
    bootWindow.destroy();
    return false;
  }
}

// 获取可用端口的辅助函数
function getAvailablePort(type) {
  return new Promise((resolve, reject) => {
    const server = gNet.createServer();

    server.on("error", error => {
      writeLog(error);
      if (type === "client") {
        kernelPort = "";
      } else if (type === "sdk") {
        kernelSDKPort = "";
      } else if (type === "governorApi") {
        governorApiPort = "";
      } else if (type === "grpc") {
        grpcPort = "";
      }
      reject(error);
    });

    server.listen(0, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

// 等待服务器就绪
async function waitForServerReady(process, serverType) {
  return new Promise((resolve) => {
    let isStarted = false;
    const timeout = setTimeout(() => {
      if (!isStarted) {
        writeLog(`${serverType} 启动超时`);
        process.kill();
        resolve(false);
      }
    }, 20000);

    process.stdout.on('data', (data) => {
      const output = data.toString();
      writeLog(`${serverType} stdout: ${output}`);
      // if ((serverType == 'kernel' && output.includes('server')) || (serverType == 'SDK' && output.includes(localServer))) {
      if (output.includes('server')) {
        isStarted = true;
        clearTimeout(timeout);
        resolve(true);
      }
    });

    process.stderr.on('data', (data) => {
      writeLog(`${serverType} stderr: ${data.toString()}`);
    });

    process.on('error', (err) => {
      writeLog(`${serverType} process error: ${err.message}`);
      clearTimeout(timeout);
      resolve(false);
    });
  });
}

// 检查服务端点是否可用
async function checkServiceEndpoint(endpoint, serverType) {
  let count = 0;
  const maxRetries = 15; // 最大重试次数
  const retryDelay = 200; // 重试间隔(ms)

  while (count < maxRetries) {
    try {
      writeLog(`Checking ${serverType} endpoint: ${endpoint}`);
      const response = await fetch(endpoint);

      if (!response.ok) {
        writeLog(`${serverType} service check failed: ${response.status} ${response.statusText}`);
        count++;
        await sleep(retryDelay);
        continue;
      }

      writeLog(`${serverType} service check successful`);
      return true;

    } catch (error) {
      writeLog(`${serverType} service check error: ${error.message}`);
      count++;

      if (count >= maxRetries) {
        showErrorWindow(
          `⚠️ ${serverType}服务检查失败 ${serverType} service check failed`,
          `<div>获取${serverType}服务端口失败，请确保程序拥有网络权限并不受防火墙和杀毒软件阻止。</div>
           <div>Failed to get ${serverType} service port, please make sure the program has network permissions and is not blocked by firewalls and antivirus software.</div>`
        );
        return false;
      }

      await sleep(retryDelay);
    }
  }

  return false;
}

// 处理 SDK 进程关闭
function handleSDKProcessClose(code) {
  writeLog(`SDK process exited with code ${code}`);
  if (code !== 0 && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("AIChatOffice-show-msg", {
      msg: `SDK服务异常退出，请重启应用\nSDK service exited abnormally, please restart the application`,
      timeout: 0
    });
  }
}

// 处理内核进程关闭
function handleKernelProcessClose(code, port) {
  writeLog(`Kernel process exited with code ${code} on port ${port}`);
  if (code !== 0 && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("AIChatOffice-show-msg", {
      msg: `内核服务异常退出，请重启应用\nKernel service exited abnormally, please restart the application`,
      timeout: 0
    });
  }
}

// 添加 before-quit 事件处理
app.on('before-quit', () => {
  isQuitting = true;
  cleanupStreams(); // 添加清理流的调用

  // 确保关闭所有进程
  if (kernelProcess) {
    kernelProcess.kill();
  }
  if (kernelSDKProcess) {
    kernelSDKProcess.kill();
  }
});

// 清理函数（建议在适当的地方调用，比如窗口关闭时）
function cleanupStreams() {
  for (const [requestId, reader] of streamReaders.entries()) {
    reader.releaseLock();
    streamReaders.delete(requestId);
    abortControllers.delete(requestId);
  }

  for (const [conversationId, requestInfo] of activeConversationRequests.entries()) {
    if (requestInfo.controller) {
      requestInfo.controller.abort();
    }
    activeConversationRequests.delete(conversationId);
  }
}
