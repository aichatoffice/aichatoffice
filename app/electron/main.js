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
let kernelPort = 8000
const confDir = path.join(app.getPath("home"), ".config", "aichatoffice")
const windowStatePath = path.join(confDir, "windowState.json")
let kernelProcess
let bootWindow
let openAsHidden = false
let workspaces = []
remote.initialize()

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

ipcMain.handle('api-request', async (event, options) => {
  const { method = 'GET', path, body } = options
  const url = `${localServer}:${kernelPort}${path}`
  writeLog(`API request: ${method} ${path}`)

  try {
    let requestBody;
    const headers = {};

    if (body && body._isFormData) {
      // 重建 FormData
      writeLog('Reconstructing FormData')
      const formData = new FormData();
      for (const [key, value] of body.entries) {
        if (value && value._isFile) {
          // 从 base64 重建文件
          const base64Data = value.content.split(',')[1];
          const buffer = Buffer.from(base64Data, 'base64');
          const blob = new Blob([buffer], { type: value.type });
          const file = new File([blob], value.name, {
            type: value.type,
            lastModified: value.lastModified
          });
          formData.append(key, file);
        } else {
          formData.append(key, value);
        }
      }
      requestBody = formData;
      writeLog('Request body is FormData');
    } else if (body) {
      headers['Content-Type'] = 'application/json';
      requestBody = JSON.stringify(body);
      writeLog(`Request body: ${requestBody}`);
    }

    const response = await fetch(url, {
      method,
      body: requestBody,
      headers
    })

    if (!response.ok) {
      const errorText = await response.text()
      writeLog(`API request failed: ${response.status} ${response.statusText}, Error: ${errorText}`)
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
    }

    const data = await response.json()
    writeLog(`API response: ${JSON.stringify(data)}`)
    return data
  } catch (error) {
    writeLog(`API request failed: ${error.message}, URL: ${url}`)
    throw error
  }
})

app.whenReady().then(() => {
  writeLog("start server: " + appDir);
  writeLog("start server dirname: " + __dirname);
  // initMainWindow()
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
  return new Promise(async (resolve) => {
    writeLog("confDir: " + confDir);
    bootWindow = new BrowserWindow({
      show: false,
      width: Math.floor(screen.getPrimaryDisplay().size.width / 2),
      height: Math.floor(screen.getPrimaryDisplay().workAreaSize.height / 2),
      frame: false,
      backgroundColor: "#1e1e1e",
      resizable: false,
      icon: path.join(appDir, "stage", "icon-large.png"),
    });
    writeLog("appDir: " + appDir);
    let bootIndex;
    if (isDevEnv) {
      bootIndex = path.join(appDir, "electron", "boot.html");
    } else {
      bootIndex = path.join(process.resourcesPath, "electron", "boot.html");
    }

    await bootWindow.loadFile(bootIndex, { query: { v: appVer } });
    if (openAsHidden) {
      bootWindow.minimize();
    } else {
      bootWindow.show();
    }

    let serverPath
    if (isDevEnv) {
      serverPath = path.join(appDir, "electron", "server", 'aichatoffice');
    } else {
      serverPath = path.join(process.resourcesPath, "electron", "server", 'aichatoffice');
    }
    if (!isDevEnv) {
      writeLog("serverPath: " + serverPath);
      if (!fs.existsSync(serverPath)) {
        showErrorWindow("⚠️ 内核程序丢失 Kernel program is missing", `<div>内核程序丢失，请重新安装 AIChatOffice ，并将 AIChatOffice 内核程序加入杀毒软件信任列表。</div><div>The kernel program is not found, please reinstall AIChatOffice and add AIChatOffice Kernel prgram into the trust list of your antivirus software.</div><div><i>${serverPath}</i></div>`);
        bootWindow.destroy();
        resolve(false);
        return;
      }
    }
    // 非开发环境下，使用本地 server 自己起
    let port = ""
    if (!isDevEnv || workspaces.length > 0) {
      if (port && "" !== port) {
        kernelPort = port;
      } else {
        const getAvailablePort = () => {
          // https://gist.github.com/mikeal/1840641
          return new Promise((portResolve, portReject) => {
            const server = gNet.createServer();
            server.on("error", error => {
              writeLog(error);
              kernelPort = "";
              portReject();
            });
            server.listen(0, () => {
              kernelPort = server.address().port;
              server.close(() => portResolve(kernelPort));
            });
          });
        };
        await getAvailablePort();
        writeLog("got kernel port123 [" + kernelPort + "]");

      }
    }
    writeLog("got kernel port [" + kernelPort + "]");

    if (!kernelPort) {
      bootWindow.destroy();
      resolve(false);
      return;
    }
    // 生成运行时配置文件
    const configPath = generateRuntimeConfig()

    // 添加配置文件路径到启动参数
    const cmds = ["--config=" + configPath, "server"];

    writeLog(`ui version [${appVer}], booting kernel [${serverPath} ${cmds.join(" ")}]`);

    let count = 0;
    writeLog("checking kernel version");

    // 调试模式下，自己启动 go 服务
    // 正式环境下，启动 go 服务
    if (!isDevEnv || workspaces.length > 0) {
      kernelProcess = cp.spawn(serverPath, cmds, {
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // 添加服务器就绪状态检查
      let isServerReady = false;
      kernelProcess.stdout.on('data', (data) => {
        writeLog(`kernel stdout: ${data}`);
        if (data.toString().includes('server')) {
          isServerReady = true;
        }
      });

      // 等待服务器就绪
      await new Promise((resolve) => {
        const checkReady = () => {
          if (isServerReady) {
            resolve();
          } else {
            setTimeout(checkReady, 100);
          }
        };
        checkReady();
      });

      // 给服务器一些启动时间
      await sleep(1000);

      const currentKernelPort = kernelPort;
      writeLog("booted kernel process [pid=" + kernelProcess.pid + ", port=" + kernelPort + "]");
      kernelProcess.on("close", (code) => {
        writeLog(`kernel [pid=${kernelProcess.pid}, port=${currentKernelPort}] exited with code [${code}]`);
        if (0 !== code) {
          let errorWindowId;
          switch (code) {
            case 20:
              errorWindowId = showErrorWindow("⚠️ 数据库被锁定 The database is locked", "<div>数据库文件正在被其他进程占用，请检查是否同时存在多个内核进程（aichatoffice Kernel）服务相同的工作空间。</div><div>The database file is being occupied by other processes, please check whether there are multiple kernel processes (AIChatOffice Kernel) serving the same workspace at the same time.</div>");
              break;
            case 21:
              errorWindowId = showErrorWindow("⚠️ 监听端口 " + currentKernelPort + " 失败 Failed to listen to port " + currentKernelPort, "<div>监听 " + currentKernelPort + " 端口失败，请确保程序拥有网络权限并不受防火墙和杀毒软件阻止。</div><div>Failed to listen to port " + currentKernelPort + ", please make sure the program has network permissions and is not blocked by firewalls and antivirus software.</div>");
              break;
            case 24: // 工作空间已被锁定，尝试切换到第一个打开的工作空间
              if (workspaces && 0 < workspaces.length) {
                showWindow(workspaces[0].browserWindow);
              }
              errorWindowId = showErrorWindow("⚠️ 工作空间已被锁定 The workspace is locked", "<div>该工作空间正在被使用，请尝试在任务管理器中结束 AIChatOffice-Kernel 进程或者重启操作系统后再启动思源。</div><div>The workspace is being used, please try to end the AIChatOffice-Kernel process in the task manager or restart the operating system and then start AIChatOffice.</div>");
              break;
            case 25:
              errorWindowId = showErrorWindow("⚠️ 初始化工作空间失败 Failed to create workspace directory", "<div>初始化工作空间失败。</div><div>Failed to init workspace.</div>");
              break;
            case 26:
              errorWindowId = showErrorWindow("🚒 已成功避免潜在的数据损坏<br>Successfully avoid potential data corruption", "<div>工作空间下的文件正在被第三方软件（比如同步网盘、杀毒软件等）打开占用，继续使用会导致数据损坏，思源内核已经安全退出。<br><br>请将工作空间移动到其他路径后再打开，停止同步盘同步工作空间，并将工作空间加入杀毒软件信任列表。如果以上步骤无法解决问题，请参考<a href=\"https://ld246.com/article/1684586140917\" target=\"_blank\">这里</a>或者<a href=\"https://ld246.com/article/1649901726096\" target=\"_blank\">发帖</a>寻求帮助。</div><hr><div>The files in the workspace are being opened and occupied by third-party software (such as synchronized network disk, antivirus software, etc.), continuing to use it will cause data corruption, and the AIChatOffice Kernel is already safe shutdown.<br><br>Move the workspace to another path and open it again, stop the network disk to sync the workspace, and add the workspace to the antivirus software trust list. If the above steps do not resolve the issue, please look for help or report bugs <a href=\"https://liuyun.io/article/1686530886208\" target=\"_blank\">here</a>.</div>");
              break;
            case 0:
              break;
            default:
              errorWindowId = showErrorWindow("⚠️ 内核因未知原因退出 The kernel exited for unknown reasons", `<div>思源内核因未知原因退出 [code=${code}]，请尝试重启操作系统后再启动思源。如果该问题依然发生，请检查杀毒软件是否阻止思源内核启动。</div><div>AIChatOffice Kernel exited for unknown reasons [code=${code}], please try to reboot your operating system and then start AIChatOffice again. If occurs this problem still, please check your anti-virus software whether kill the AIChatOffice Kernel.</div>`);
              break;
          }
          bootWindow.destroy();
          resolve(false);
        }
      });
    }

    writeLog("before checking kernel version");
    // 检测端口是否启动成功
    for (; ;) {
      try {
        writeLog("getServer: " + getServer());
        const apiResult = await net.fetch(getServer() + "/showcase/files");
        writeLog(apiResult)
        break;
      } catch (e) {
        writeLog("get kernel version failed: " + e.message);
        if (14 < ++count) {
          writeLog("get kernel ver failed");
          showErrorWindow("⚠️ 获取内核服务端口失败 Failed to get kernel serve port", "<div>获取内核服务端口失败，请确保程序拥有网络权限并不受防火墙和杀毒软件阻止。</div><div>Failed to get kernel serve port, please make sure the program has network permissions and is not blocked by firewalls and antivirus software.</div>");
          bootWindow.destroy();
          resolve(false);
          return;
        }
        sleep(200);
      }
    }
    resolve(true);
  })
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
    // 在 macOS 上,点击红色关闭按钮时只隐藏窗口
    if (process.platform === 'darwin' && !app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return;
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("AIChatOffice-save-close", false);
    }
    // event.preventDefault();
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

// 生成运行时配置文件
function generateRuntimeConfig() {
  // 创建配置文件目录
  const configDir = path.join(confDir, "config");
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  // 生成运行时配置文件内容
  const runtimeConfig =
    `
[server]
host = "0.0.0.0"
port = ${kernelPort}
enableAccessInterceptor = true
enableAccessInterceptorRes = true
embedPath = "dist"

[leveldb]
path = "${path.join(confDir, "leveldb")}"

[host]
downloadUrlPrefix = "${localServer}:${kernelPort}"
previewUrlPrefix = "https://turbo-sdk.shimorelease.com"

[case]
resourcePath = "${isDevEnv ? "./resource" : path.join(process.resourcesPath, "electron", "resource")}"
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

const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};