/*
 * @Author: Sid Li
 * @Date: 2026-06-04 17:00:25
 * @LastEditors: Sid Li
 * @LastEditTime: 2026-06-09 16:40:02
 * @Description: 越疆机器人 在线模式完整API + 手势TCP控制
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // 窗口控制
  minimizeWindow: () => ipcRenderer.send("window-minimize"),
  maximizeWindow: () => ipcRenderer.send("window-maximize"),
  closeWindow: () => ipcRenderer.send("window-close"),

  // 内存监听
  onMemoryUsage: (callback) => {
    ipcRenderer.on("memory-usage", (_, data) => callback(data));
    return () => ipcRenderer.removeAllListeners("memory-usage");
  },

  // 全屏状态
  onFullScreenStatus: (callback) => {
    ipcRenderer.on("fullscreen-status", (_, data) => callback(data));
    return () => ipcRenderer.removeAllListeners("fullscreen-status");
  },

  // ========== 越疆机器人 TCP ==========
  connectRobot: (ip, port) => ipcRenderer.invoke("robot:connect", ip, port),
  sendRobotCmd: (cmd) => ipcRenderer.invoke("robot:send", cmd),
  disconnectRobot: () => ipcRenderer.invoke("robot:disconnect"),

  // 扫描
  scanRobots: (port) => ipcRenderer.invoke("robot:scan", port),

  // 使能
  enableRobot: () => ipcRenderer.invoke("robot:enable"),
  // 下使能
  disableRobot: () => ipcRenderer.invoke("robot:disable"),

  // 停止运动
  MoveJog: (axisID) => ipcRenderer.invoke("robot:moveJog", axisID),
  // 设置TCP模式
  setTcpMode: () => ipcRenderer.invoke("robot:setTcpMode"),
  // 清除错误
  clearErrorRobot: () => ipcRenderer.invoke("robot:clearError"),

  // 机器人消息监听
  onRobotMessage: (cb) => {
    ipcRenderer.on("robot:message", (_, msg) => cb(msg));
    return () => ipcRenderer.removeAllListeners("robot:message");
  },

  // 机器人反馈监听
  onRobotFeedback: (cb) => {
    ipcRenderer.on("robot:feedback", (_, data) => cb(data));
    return () => ipcRenderer.removeAllListeners("robot:feedback");
  },

  // ============================
  //  手势 TCP 控制 API
  // ============================
  connectGesture: (ip, port) => ipcRenderer.invoke("gesture:connect", ip, port),
  disconnectGesture: () => ipcRenderer.invoke("gesture:disconnect"),

  // 监听手势数据
  onGestureData: (cb) => {
    ipcRenderer.on("gesture:data", (_, data) => cb(data));
    return () => ipcRenderer.removeAllListeners("gesture:data");
  },

  // 进入关节拖拽模式
  startDragRobot: () => ipcRenderer.invoke("robot:startDrag"),
  // 退出拖拽模式
  stopDragRobot: () => ipcRenderer.invoke("robot:stopDrag"),

  // 获取当前末端位姿（x,y,z,rx,ry,rz）
  getRobotPose: () => ipcRenderer.invoke("robot:getPose"),

  // 逆解：位姿 → 关节角度
  ikSolve: (pose) => ipcRenderer.invoke("robot:ikSolve", pose),

  // 获取当前关节角度（度数）
  getRobotAngle: () => ipcRenderer.invoke("robot:getAngle"),
});
