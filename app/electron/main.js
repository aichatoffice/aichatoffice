import { app, protocol, net, BrowserWindow, screen, ipcMain } from 'electron'
import Store from 'electron-store'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import url from 'node:url'
import fs, { write } from 'node:fs'
import gNet from 'net'
import cp from 'child_process'
import remote from '@electron/remote/main/index.js'
import yauzl from 'yauzl'

// ES模块中 __dirname 的替代方案
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow
const appDir = path.dirname(app.getAppPath())
const isDevEnv = process.env.NODE_ENV === "development"
const appVer = app.getVersion()
let kernelPort = 9011 // 本地调试时需要修改为本地后服务端口
let kernelSDKPort = 0
let governorApiPort = 0
let grpcPort = 0

const confDir = path.join(app.getPath("home"), ".config", "aichatoffice")
const windowStatePath = path.join(confDir, "windowState.json")
let kernelProcess
let kernelSDKProcess
let bootWindow
let openAsHidden = false
// 根据不同环境下载对应执行包 x86_64
// 执行包
let turbooneExec = "turboone"
let aichatofficeExec = "aichatoffice-x64"
// 执行包下载地址
let turbooneExecUrl = ""

let workspaces = []
remote.initialize()

// 添加新的变量来追踪 dock 点击事件
let isQuitting = false;

const storeInstance = new Store()

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

ipcMain.handle('get-server-url', () => {
  return getServer()
})

// 注册所有 store 相关的 IPC 处理程序
function registerStoreHandlers() {
  // 获取特定键的值
  ipcMain.handle('get-store-value', async (event, key) => {
    try {
      return storeInstance.get(key);
    } catch (error) {
      writeLog(`获取 store 值失败: ${error.message}`);
      throw error;
    }
  });

  // 设置特定键的值
  ipcMain.handle('set-store-value', async (event, key, value) => {
    try {
      console.log('set-store-value', key, value);
      storeInstance.set(key, value);
      return true;
    } catch (error) {
      writeLog(`设置 store 值失败: ${error.message}`);
      throw error;
    }
  });

  // 删除特定键
  ipcMain.handle('delete-store-value', async (event, key) => {
    try {
      storeInstance.delete(key);
      return true;
    } catch (error) {
      writeLog(`删除 store 值失败: ${error.message}`);
      throw error;
    }
  });

  // 清除所有数据
  ipcMain.handle('clear-store', async () => {
    try {
      storeInstance.clear();
      return true;
    } catch (error) {
      writeLog(`清除 store 失败: ${error.message}`);
      throw error;
    }
  });
}

// ipcMain.handle('open-auth-window', async (event, options) => {
//   const { url, width, height } = options;
//   return new Promise((resolve, reject) => {
//     const authWindow = new BrowserWindow({
//       width: width || 800,
//       height: height || 600,
//       frame: true,
//       parent: mainWindow,
//       webPreferences: {
//         nodeIntegration: true,
//         contextIsolation: false,
//       },
//       resizable: false,
//       minimizable: false,
//       maximizable: false,
//       alwaysOnTop: true,
//     });
//     let isResolved = false;
//     authWindow.loadURL(url).then(() => {
//       authWindow.show();
//       authWindow.focus();
//     });
//     const handleUrl = (targetUrl) => {
//       console.log('导航到:', targetUrl);
//       const parsedUrl = new URL(targetUrl);
//       const origin = parsedUrl.origin;

//       if (origin === 'http://localhost:9001') {
//         const searchParams = parsedUrl.searchParams;
//         const error = searchParams.get('error');
//         const code = searchParams.get('code');
//         const state = searchParams.get('state');

//         if (error) {
//           if (!isResolved) {
//             isResolved = true;
//             authWindow.close();
//             reject(new Error(`登录失败: ${error}`));
//           }
//         } else if (code && state) {
//           if (!isResolved) {
//             isResolved = true;
//             authWindow.close();
//             resolve({ success: true, code, state });
//           }
//         }
//       }
//     };

//     authWindow.webContents.on('will-redirect', (event, url) => handleUrl(url));
//     authWindow.webContents.on('will-navigate', (event, url) => handleUrl(url));

//     authWindow.on('closed', () => {
//       if (!isResolved) {
//         reject(new Error('用户取消了登录'));
//       }
//     });
//   });
// });

app.whenReady().then(() => {
  writeLog("start server: " + appDir);
  writeLog("start server dirname: " + __dirname);

  // 注册 store 处理程序
  registerStoreHandlers();

  // 添加 dock 点击事件处理
  app.on('activate', () => {
    // 检查 mainWindow 是否存在且未被销毁
    if (!mainWindow || mainWindow.isDestroyed()) {
      initMainWindow()
    } else {
      // 确保在显示窗口前检查其状态
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }
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
    if (!isDevEnv && !await checkServerExecutables(serverPath, sdkServerPath)) {
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

    showErrorWindow("⚠️ Server startup failed",
      `<div>下载服务程序失败,请检查网络连接后重试。</div>
       <div><i>${error.message}</i></div>`);

    if (bootWindow && !bootWindow.isDestroyed()) {
      bootWindow.destroy();
    }
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
    resizable: false,
    icon: path.join(appDir, "stage", "icon-large.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
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
  // 根据不同环境下载对应执行包 
  if (process.arch === "x64") {
    // x86_64
    aichatofficeExec = "aichatoffice-x64"
    turbooneExecUrl = "https://aichatoffice-test.obs.cn-north-4.myhuaweicloud.com:443/artifacts-amd64.zip?AccessKeyId=4SI2S33CZY6DS2IUVYWT&Expires=1774758868&Signature=G3okMCkG64CjOGLu2ZUR/%2BEO3qU%3D"
  } else if (process.arch === "arm64") {
    // arm64
    aichatofficeExec = "aichatoffice-arm64"
    turbooneExecUrl = "https://aichatoffice-test.obs.cn-north-4.myhuaweicloud.com:443/artifacts-arm64.zip?AccessKeyId=4SI2S33CZY6DS2IUVYWT&Expires=1774758895&Signature=SzZWME6w3980Vt6BjoreFpxlcuI%3D"
  } else {
    throw new Error("Unsupported architecture: " + process.arch)
  }
  // server服务打入了eletron包内
  const basePath = isDevEnv ? path.join(appDir, "electron", "server") : path.join(process.resourcesPath, "electron", "server");
  // sdk服务在外部configDir下
  const sdkBasePath = isDevEnv ? path.join(appDir, "electron", "server") : path.join(confDir, "server");
  return {
    serverPath: path.join(basePath, aichatofficeExec),
    sdkServerPath: path.join(sdkBasePath, turbooneExec)
  };
}

async function checkServerExecutables(serverPath, sdkServerPath) {
  // 分别检查每个可执行文件
  const needsSDKDownload = !fs.existsSync(sdkServerPath);

  if (needsSDKDownload) {
    try {
      if (needsSDKDownload) {
        await downloadExecutable(turbooneExecUrl, sdkServerPath, 'sdk');
      }
    } catch (error) {
      showErrorWindow("⚠️ 下载失败 Download failed",
        `<div>下载服务程序失败,请检查网络连接后重试。</div>
         <div>Failed to download service programs, please check network connection and retry.</div>
         <div><i>${error.message}</i></div>`);
      bootWindow.destroy();
      return false;
    }
  }

  // 验证文件是否存在和可执行
  if (!fs.existsSync(serverPath)) {
    showErrorWindow("⚠️ 内核程序丢失 Kernel program is missing",
      `<div>内核程序丢失，请重新安装 AIChatOffice。</div>
       <div>The kernel program is not found, please reinstall AIChatOffice.</div>
       <div><i>${serverPath}</i></div>`);
    bootWindow.destroy();
    return false;
  }

  if (!fs.existsSync(sdkServerPath)) {
    showErrorWindow("⚠️ SDK程序丢失 SDK program is missing",
      `<div>SDK程序丢失，请重新安装 AIChatOffice。</div>
       <div>The SDK program is not found, please reinstall AIChatOffice.</div>
       <div><i>${sdkServerPath}</i></div>`);
    bootWindow.destroy();
    return false;
  }

  return true;
}

// 更新 downloadExecutable 函数以支持新的进度格式
async function downloadExecutable(url, destPath, fileType) {
  if (bootWindow) {
    bootWindow.webContents.send('download-progress', {
      status: 'start',
      message: `开始下载${fileType === 'kernel' ? '内核' : 'SDK'}程序...`
    });
  }

  try {
    await downloadFile(url, destPath, (progress) => {
      if (bootWindow) {
        bootWindow.webContents.send('download-progress', {
          file: fileType,
          progress: progress.progress,
          status: progress.phase
        });
      }
    });

    if (bootWindow) {
      bootWindow.webContents.send('download-progress', {
        status: 'complete',
        message: `${fileType === 'kernel' ? '内核' : 'SDK'}程序安装完成`
      });
    }
  } catch (error) {
    writeLog(`下载失败: ${error.message}`);
    throw error;
  }
}

// 下载单个可执行文件的函数
async function downloadFile(url, destPath, onProgress) {
  const tempDir = path.join(confDir, 'temp');
  const tempFileName = `download_${Date.now()}.tmp`;
  const tempPath = path.join(tempDir, tempFileName);
  const isZipFile = url.includes('.zip');

  try {
    // 确保临时目录存在
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true, mode: 0o755 });
      writeLog(`创建临时目录: ${tempDir}`);
    }

    // 确保目标目录存在
    const targetDir = path.dirname(destPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true, mode: 0o755 });
      writeLog(`创建目标目录: ${targetDir}`);
    }

    // 下载文件
    writeLog(`开始从华为云下载文件: ${url} 到临时文件 ${tempPath}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const totalSize = parseInt(response.headers.get('content-length'), 10);
    let downloadedSize = 0;
    const fileStream = fs.createWriteStream(tempPath);
    const reader = response.body.getReader();

    // 处理下载进度
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      fileStream.write(Buffer.from(value));
      downloadedSize += value.length;
      const progress = downloadedSize / totalSize;
      onProgress({ phase: 'downloading', progress: progress });
      writeLog(`下载进度: ${(progress * 100).toFixed(2)}%`);
    }

    fileStream.end();
    await new Promise((resolve, reject) => {
      fileStream.on('finish', resolve);
      fileStream.on('error', reject);
    });

    // 主解压流程
    if (isZipFile) {
      writeLog('开始解压文件...');
      onProgress({ phase: 'extracting', progress: 0 });
      const extractDir = path.join(tempDir, `extract_${Date.now()}`);

      try {
        await extractZipFile(tempPath, extractDir, onProgress);
        writeLog(`查找可执行文件: ${turbooneExec}`);

        const execFilePath = await findExecutableFile(extractDir, turbooneExec, onProgress);
        if (!execFilePath) {
          throw new Error(`未找到可执行文件: ${turbooneExec}`);
        }

        writeLog(`找到可执行文件: ${execFilePath}`);

        // 确保目标路径的目录存在
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }

        // 移动文件到目标位置
        fs.renameSync(execFilePath, destPath);
        fs.chmodSync(destPath, 0o755);

        // 清理解压目录
        fs.rmSync(extractDir, { recursive: true, force: true });
      } catch (error) {
        writeLog(`处理过程发生异常: ${error.message}`);
        throw error;
      }
    } else {
      // 非zip文件直接移动到目标位置
      fs.renameSync(tempPath, destPath);
      fs.chmodSync(destPath, 0o755);
    }

    writeLog('文件处理完成');

    // 清理临时文件
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }

    return true;
  } catch (error) {
    writeLog(`处理过程发生异常: ${error.message}`);
    // 清理临时文件
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
        writeLog(`删除未完成的临时文件: ${tempPath}`);
      }
      if (fs.existsSync(destPath)) {
        fs.unlinkSync(destPath);
        writeLog(`删除未完成的目标文件: ${destPath}`);
      }
    } catch (unlinkError) {
      writeLog(`删除临时文件失败: ${unlinkError.message}`);
    }
    throw error;
  }
}

// 统一的解压函数
async function extractZipFile(zipPath, extractDir, onProgress) {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);

      const totalEntries = zipfile.entryCount;
      let processedEntries = 0;

      zipfile.on('entry', (entry) => {
        if (/\/$/.test(entry.fileName)) {
          processedEntries++;
          zipfile.readEntry();
          return;
        }

        const targetPath = path.join(extractDir, entry.fileName);
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });

        zipfile.openReadStream(entry, (err, readStream) => {
          if (err) return reject(err);

          const writeStream = fs.createWriteStream(targetPath);
          readStream.pipe(writeStream);

          writeStream.on('finish', () => {
            processedEntries++;
            const progress = processedEntries / totalEntries;
            onProgress({ phase: 'extracting', progress });
            writeLog(`解压进度: ${(progress * 100).toFixed(2)}%`);
            zipfile.readEntry();
          });
        });
      });

      zipfile.on('end', () => {
        writeLog('解压完成');
        onProgress({ phase: 'extracting', progress: 1 });
        resolve(extractDir);
      });

      zipfile.readEntry();
    });
  });
}

// 递归查找指定名称的可执行文件
async function findExecutableFile(dir, execName, onProgress) {
  const items = fs.readdirSync(dir);
  writeLog(`当前目录 ${dir} 内容: ${JSON.stringify(items)}`);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      const found = await findExecutableFile(fullPath, execName, onProgress);
      if (found) return found;
    } else if (item === execName) {
      return fullPath;
    } else if (item.endsWith('.zip')) {
      writeLog(`发现嵌套zip文件: ${item}`);
      const nestedExtractDir = path.join(dir, `nested_extract_${Date.now()}`);

      try {
        await extractZipFile(fullPath, nestedExtractDir, onProgress);
        const found = await findExecutableFile(nestedExtractDir, execName, onProgress);
        if (found) return found;
      } catch (error) {
        writeLog(`处理嵌套zip文件失败: ${error.message}`);
      }
    }
  }
  return null;
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
    defaultWidth = Math.floor(screen.getPrimaryDisplay().size.width * 0.85);
    defaultHeight = Math.floor(screen.getPrimaryDisplay().workAreaSize.height * 0.92);
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
    minWidth: windowState.width / 1.5,
    minHeight: windowState.width / 2,
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
    icon: path.join(appDir, "public", "avatar.png"),
    frame: false,  // 去掉默认窗口边框和标题栏
    titleBarStyle: 'hidden',  // 隐藏原生的标题栏
    titleBarOverlay: {
      color: '#ffffff',        // 设置标题栏背景色为白色
      symbolColor: '#000000',  // 设置窗口控制按钮的颜色
      height: 30               // 设置标题栏的高度
    },
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
    // 确保 mainWindow 存在且未被销毁
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    // 在 macOS 上，点击红色关闭按钮时只隐藏窗口
    if (process.platform === 'darwin' && !isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return;
    }

    // 发送保存信号
    mainWindow.webContents.send("AIChatOffice-save-close", false);
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
    width: Math.floor(screen.getPrimaryDisplay().size.width * 0.4),
    height: Math.floor(screen.getPrimaryDisplay().workAreaSize.height * 0.65),
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

[store]
type = "sqlite"
enableExpireJob = true
expireJobInterval = "5s"

[logger]
# dir = "${logsDir}"
writer = "stdout"

#[leveldb]
#path = "${path.join(confDir, "leveldbstore")}"

[sqlite]
path = "${path.join(confDir, "sqlite")}"

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
aiIcon = "https://cdn-icons-png.flaticon.com/512/5278/5278402.png"
`

  // 将配置写入文件
  const configPath = path.join(configDir, "config.toml");
  fs.writeFileSync(configPath, runtimeConfig);
  writeLog("Config file written to: " + configPath);
  writeLog("Config content: " + runtimeConfig);  // 添加日志以便调试

  return configPath
}

// 生成运行时 SDK配置文件
function generateSDKRuntimeConfig() {
  // 创建配置文件目录
  const configDir = path.join(confDir, "SDKconfig");
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  // 创建api.yaml文件
  const apiYaml = `
ip: "127.0.0.1"
license: "PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPCFET0NUWVBFIHBsaXN0IFBVQkxJQyAiLS8vQXBwbGUvL0RURCBQTElTVCAxLjAvL0VOIiAiaHR0cDovL3d3dy5hcHBsZS5jb20vRFREcy9Qcm9wZXJ0eUxpc3QtMS4wLmR0ZCI+CjxwbGlzdCB2ZXJzaW9uPSIxLjAiPgogIDxkaWN0PgogICAgPGtleT5BZG1pbkVtYWlsPC9rZXk+CiAgICA8c3RyaW5nPnRlc3RAc2hpbW8uaW08L3N0cmluZz4KICAgIDxrZXk+QWRtaW5QYW5lbFBhc3N3ZDwva2V5PgogICAgPHN0cmluZz50ZXN0X3NoaW1vPC9zdHJpbmc+CiAgICA8a2V5PkZlYXR1cmVNYXA8L2tleT4KICAgIDxzdHJpbmc+eyYjMzQ7MCYjMzQ7OnRydWUsJiMzNDsxJiMzNDs6dHJ1ZSwmIzM0OzImIzM0Ozp0cnVlfTwvc3RyaW5nPgogICAgPGtleT5MaWNlbnNlVHlwZTwva2V5PgogICAgPHN0cmluZz4wPC9zdHJpbmc+CiAgICA8a2V5PkxpY2Vuc2VWZXJzaW9uPC9rZXk+CiAgICA8c3RyaW5nPjwvc3RyaW5nPgogICAgPGtleT5NYWNoaW5lU2VyaWFsPC9rZXk+CiAgICA8c3RyaW5nPnRyaWFsX2xpbnV4PC9zdHJpbmc+CiAgICA8a2V5Pk5hbWU8L2tleT4KICAgIDxzdHJpbmc+bGludXjkvZPpqozniYg8L3N0cmluZz4KICAgIDxrZXk+UHJvZHVjdDwva2V5PgogICAgPHN0cmluZz50dXJibzwvc3RyaW5nPgogICAgPGtleT5TaWduYXR1cmU8L2tleT4KICAgIDxkYXRhPkV1c09Mb0IrWHpqTTFObVpqZFQyaUVHMDJLTXh0ZGFjTC82WXBuT3Y1ci9QVW5IejdpNENSSFlKdXJZa1lEWmdIS2dSc1BYZE9HaTMyS2pNUTFtcFhCcFZNaFUwRU1HRklwdW5DR1phV05pMFJBQXIvcmVmSnFacWVEWXNBeGRKREVTOGZYM2tzYkltMHBMdEZ2amtBMDVrRXlVL0JqK1RxN0xJZExpY0tCWlNBNkI0ay9adjFmSDIyRDBVZ08vc1pUVTFMVHozaHc0aXlSS3RsV2crZVVCNHBIWVlVYWp2ZUxkdUNLRzlGaktDUEc0QW9wKzliVlJoTnQzRWo1d2J6c1AybEk1MjRiOHZPM3RDa09RdUVZYXlRSnJiM1lJNVNXbXgwd25Hb2FSTnZ6aHBQZnl1ZVRkTGlEam8zMnpYMnQzYlNGUi9FSDE4NnkwZXkzbzdRZz09PC9kYXRhPgogICAgPGtleT5WYWxpZEZyb208L2tleT4KICAgIDxzdHJpbmc+MjAyNS0wMy0yN1QwMDowMDowMCswODowMDwvc3RyaW5nPgogICAgPGtleT5WYWxpZFVudGlsPC9rZXk+CiAgICA8c3RyaW5nPjIwMjYtMDMtMjRUMjM6NTk6NTkrMDg6MDA8L3N0cmluZz4KICA8L2RpY3Q+CjwvcGxpc3Q+"
rootURL: ${getSDKerver()}
  `
  // 将 api.yaml 直接创建在 confDir 目录下
  const apiYamlPath = path.join(configDir, "api.yaml");
  fs.writeFileSync(apiYamlPath, apiYaml);
  writeLog(`Created api.yaml at: ${apiYamlPath}`);

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
maxRecvMsgSize = 500
maxSendMsgSize = 10

[logger.default]
level = "info"
writer = "file"
dir = "logs"
maxSize = 50
maxBackup = 6

[logger.ego]
level = "info"
writer = "file"
dir = "logs"
maxSize = 50
maxBackup = 6

[preview]
fileValidDays = 7
totalFileSizeLimitBytes = 100
fileDir = "${path.join(cdnDir, "files")}"
fileReplaceExts = [".emf", ".wmf", ".chart", ".tif", ".tiff"]

[preview.static.rule]
lizard-service-preview = [
    "assets",
    "templates",
    "service.scripts",
    "service.styles",
]
lizard-service-docx-sdk = ["assets", "service.scripts", "service.styles"]
lizard-service-presentation-sdk = [
    "assets",
    "service.scripts",
    "service.styles",
]
lizard-service-sheet-sdk = ["assets", "service.scripts", "service.styles"]
lizard-service-ai = ["assets", "service.scripts", "service.styles"]

[preview.convert]
tmpDir = "${path.join(confDir, "tmp")}"
configPath = "${path.join(configDir, "config.toml")}"

[preview.watermark.copyright]
enable = true
text = "officesdk.com"

[apiStore]
storeType = "leveldb"

[apiStore.leveldb]
path = "${path.join(confDir, "apileveldb")}"

[chatStore]
storeType = "leveldb"

[chatStore.leveldb]
path = "${path.join(confDir, "chatleveldb")}"

[callback]
configFileName = "${isDevEnv ? "./server/callback.yaml" : path.join(process.resourcesPath, "electron", "server", "callback.yaml")}"
timeoutSec = 10
uploadTimeoutSec = 600
retryAttempts = 3
retryDelaySec = 1

[stream]
apiConfigFileName = "${path.join(configDir, "api.yaml")}"

[license]
fileSizeLimit = "1M"
checkGRPCTimeout = "5s"

[jwt]
secretKey = "i4?h_c@UGbPK_RRgf+7buu]MYbgh9~=Z"

[font]
adminDir = "${path.join(confDir, "tmp", "fonts")}"
apiDir = "${path.join(cdnDir, "fonts")}"
validMimeTypes = ["font/ttf", "font/woff"]

[tmp]
dir = "${path.join(confDir, "tmp")}"

# 下面都是 ai 用的
[userChat]
reset = ["/reset"]
timeout = 300
convertedTextDir = "${path.join(confDir, "converted")}"

[openai]
configMode = "local" # local 本地配置，remote 远程回调配置
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
        showErrorWindow("⚠️ Server startup failed",
          `<div>服务程序启动超时,请检查网络连接后重试。</div>
           <div><i>${error.message}</i></div>`);
        process.kill();
        resolve(false);
      }
    }, 20000);

    process.stdout.on('data', (data) => {
      const output = data.toString();
      writeLog(`${serverType} stdout: ${output}`);
      // if ((serverType == 'kernel' && output.includes('server')) || (serverType == 'SDK' && output.includes(localServer))) {
      if (output.includes('server') || output.includes('resource') || output.includes(localServer)) {
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
  try {
    for (const [requestId, reader] of streamReaders.entries()) {
      if (reader && typeof reader.releaseLock === 'function') {
        reader.releaseLock();
      }
      streamReaders.delete(requestId);
      abortControllers.delete(requestId);
    }

    for (const [conversationId, requestInfo] of activeConversationRequests.entries()) {
      if (requestInfo && requestInfo.controller) {
        requestInfo.controller.abort();
      }
      activeConversationRequests.delete(conversationId);
    }
  } catch (error) {
    writeLog(`Error during cleanup: ${error.message}`);
  }
}

// 添加窗口状态追踪
app.on('window-all-closed', () => {
  // 在 macOS 上，除非用户使用 Cmd + Q 明确退出
  // 否则保持应用程序活动状态
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

