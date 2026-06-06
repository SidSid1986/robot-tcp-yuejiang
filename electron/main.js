/*
 * @Author: Sid Li
 * @Date: 2026-06-04 17:00:25
 * @LastEditors: Sid Li
 * @LastEditTime: 2026-06-06 08:45:36
 * @FilePath: \0606yuejiang\electron\main.js
 * @Description: 
 */
const { app } = require("electron");
const { log } = require("./logger");
const { createWindow, getMainWindow } = require("./windowManager");
const { registerFileProtocolInterceptor } = require("./protocol");
const { registerIPC } = require("./ipc");

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// ARM Linux 兼容
if (process.platform === "linux" && process.arch() === "arm64") {
  app.commandLine.appendSwitch("no-sandbox");
  app.commandLine.appendSwitch("disable-gpu");
}

app.whenReady().then(() => {
  app.commandLine.appendSwitch("disable-site-isolation-trials");
  app.commandLine.appendSwitch("ignore-certificate-errors");
  app.commandLine.appendSwitch("allow-insecure-localhost");

  log("Electron 就绪");

  //  windowManager 创建窗口
  createWindow();

  //  注册IPC
  registerIPC();

  // 延迟注册协议拦截
  setTimeout(() => {
    const win = getMainWindow();
    if (win) {
      registerFileProtocolInterceptor(win);
    }
  }, 300);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (getMainWindow() === null) {
    createWindow();
  }
});

// 错误捕获
process.on("uncaughtException", (err) => {
  log(`崩溃: ${err.message}`);
});
process.on("unhandledRejection", (reason) => {
  log(`Promise 异常: ${reason}`);
});

log("主进程初始化完成");
