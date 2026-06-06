const { BrowserWindow, Menu, ipcMain } = require("electron");
const path = require("path");
const os = require("os");
const fs = require("fs");
const { log } = require("./logger");
const { app } = require("electron");
const isDev = process.env.NODE_ENV === "development";

let mainWindow = null;

// 内存监控
function sendMemoryUsage() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      const memoryUsage = process.memoryUsage();
      const totalMemory = os.totalmem();
      const usedMemory = memoryUsage.heapUsed;
      const usedMemoryMB = (usedMemory / 1024 / 1024).toFixed(2);
      const totalMemoryGB = (totalMemory / 1024 / 1024 / 1024).toFixed(1);
      mainWindow.webContents.send("memory-usage", {
        used: usedMemoryMB,
        total: totalMemoryGB,
      });
      // mainWindow.setTitle(`紫小艾 - 内存使用: ${usedMemoryMB}MB`);
    } catch (error) {
      log(`发送内存信息错误: ${error.message}`);
    }
  }
}

function createWindow() {
  log("开始创建窗口");

  try {
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      frame: false,
      icon: app.isPackaged
        ? path.join(process.resourcesPath, "public/home.ico")
        : path.join(__dirname, "../public/home.ico"),
      trafficLightPosition: { x: 10, y: 10 },
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        preload: path.join(__dirname, "preload.js"),
        webSecurity: false,
        allowRunningInsecureContent: true,
        experimentalFeatures: {
          disableWebSecurityAutoUpgrade: true,
        },
        devTools: true,
        nodeIntegrationInWorker: false,
        nodeIntegrationInSubFrames: false,
      },
    });

    if (!isDev) {
      mainWindow.webContents.session.webRequest.onHeadersReceived(
        (details, callback) => {
          callback({
            responseHeaders: {
              ...details.responseHeaders,
              "Content-Security-Policy": [
                "default-src 'self' file: blob: https://cdn.jsdelivr.net;",
                "connect-src 'self' http://localhost:* ws://192.168.3.29:6789 ws://localhost:* https://cdn.jsdelivr.net;",
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net;",
                "style-src 'self' 'unsafe-inline';",
                "img-src 'self' data: file: blob:;",
                "font-src 'self' data:;",
                "media-src 'self' file: blob:;",
                "worker-src 'self' blob: https://cdn.jsdelivr.net;",
              ].join(" "),
            },
          });
        },
      );
    }

    Menu.setApplicationMenu(null);

    if (isDev) {
      log("加载开发环境: http://localhost:5173");
      mainWindow.loadURL("http://localhost:5173");
    } else {
      const indexPath = path.join(__dirname, "../dist/index.html");
      log(`加载生产环境: ${indexPath}`);
      if (!fs.existsSync(indexPath)) {
        log(`错误: index.html 文件不存在 - ${indexPath}`);
        app.quit();
        return;
      }
      mainWindow.loadFile(indexPath);
    }

    mainWindow.on("ready-to-show", () => {
      log("窗口加载完成，显示窗口");
      mainWindow.show();
    });

    // mainWindow.setTitle("紫小艾");

    // 全屏
    // 全屏 + 调试快捷键
    mainWindow.webContents.on("before-input-event", (event, input) => {
      // F11 全屏
      if (input.key === "F11" && !input.isAutoRepeat) {
        mainWindow.webContents.executeJavaScript(`
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    `);
        setTimeout(() => {
          mainWindow.setFullScreen(!mainWindow.isFullScreen());
          mainWindow.webContents.send("fullscreen-status", {
            isFullScreen: mainWindow.isFullScreen(),
          });
        }, 50);
        event.preventDefault();
      }

      // F12 打开/关闭开发者工具
      if (input.key === "F12" && !input.isAutoRepeat) {
        if (mainWindow.webContents.isDevToolsOpened()) {
          mainWindow.webContents.closeDevTools();
        } else {
          mainWindow.webContents.openDevTools({ mode: "detach" });
        }
        event.preventDefault();
      }

      // Ctrl + Shift + I 强制打开开发者工具
      if (input.control && input.shift && input.key.toLowerCase() === "i") {
        mainWindow.webContents.openDevTools({ mode: "detach" });
        event.preventDefault();
      }

      // Ctrl + R 刷新页面（调试用）
      if (input.control && input.key.toLowerCase() === "r") {
        mainWindow.webContents.reload();
        event.preventDefault();
      }
    });
    mainWindow.on("enter-full-screen", () => {
      mainWindow.webContents.send("fullscreen-status", { isFullScreen: true });
    });
    mainWindow.on("leave-full-screen", () => {
      mainWindow.webContents.send("fullscreen-status", { isFullScreen: false });
    });

    // 内存监控
    setInterval(sendMemoryUsage, 1000);

    mainWindow.on("closed", () => {
      mainWindow = null;
    });

    mainWindow.webContents.on(
      "did-fail-load",
      (event, errorCode, errorDescription) => {
        log(`窗口加载失败: ${errorCode} - ${errorDescription}`);
      },
    );

    log("窗口创建成功");
  } catch (error) {
    log(`创建窗口错误: ${error.message}`);
    log(`错误堆栈: ${error.stack}`);
    app.quit();
  }
}

function getMainWindow() {
  return mainWindow;
}

module.exports = { createWindow, getMainWindow };
