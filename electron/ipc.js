/*
 * @Author: Sid Li
 * @Date: 2026-06-04 17:00:25
 * @LastEditors: Sid Li
 * @LastEditTime: 2026-06-06 14:00:07
 * @Description: 远程控制模式（可发MoveJoint）+ 连接 + 使能 + 回原点 + 扫描 + 急停
 */
const { ipcMain } = require("electron");
const { getMainWindow } = require("./windowManager");
const net = require("net");
const os = require("os");

let robotSocket = null;
let robotConnected = false;

let feedbackSocket = null;
let feedbackBuffer = Buffer.alloc(0);

// =======================
// 手势 TCP 客户端
// =======================
let gestureSocket = null;
let gestureConnected = false;

const DASH_PORT = 29999;
const REAL_DATA_PORT = 30005;

// 官方机型映射表
const ROBOT_TYPE_MAP = {
  3: "CR3",
  5: "CR5",
  7: "CR7",
  10: "CR10",
  12: "CR12",
  16: "CR16",
  101: "Nova 2",
  103: "Nova 5",
  113: "CR3A",
  115: "CR5A",
  117: "CR7A",
  120: "CR10A",
  122: "CR12A",
  126: "CR16A",
  130: "CR20A",
  150: "Magician E6",
  161: "Nova 5",
};

function registerIPC() {
  // 窗口控制
  ipcMain.on("window-minimize", () => getMainWindow()?.minimize());
  ipcMain.on("window-maximize", () => {
    const w = getMainWindow();
    if (w) w.isMaximized() ? w.unmaximize() : w.maximize();
  });
  ipcMain.on("window-close", () => getMainWindow()?.close());

  // ==============================================
  // 连接机器人
  // ==============================================
  ipcMain.handle("robot:connect", async (_, ip, port) => {
    return new Promise((resolve) => {
      if (robotSocket) robotSocket.destroy();

      robotSocket = new net.Socket();

      let connected = false;

      const connectTimer = setTimeout(() => {
        if (!connected) {
          robotSocket.destroy();
          robotConnected = false;
          resolve(false);
        }
      }, 3000);

      robotSocket.connect(port, ip, () => {
        connected = true;
        clearTimeout(connectTimer);

        robotConnected = true;
        robotSocket.setKeepAlive(true, 1000);

        console.log(" 机器人连接成功");
        startFeedback(ip);
        resolve(true);
      });

      robotSocket.on("data", (data) => {
        const msg = data.toString().trim();
        console.log("[机器人消息]", msg);
        getMainWindow()?.webContents.send("robot:message", msg);
      });

      robotSocket.on("error", (err) => {
        console.log("机器人连接错误:", err.message);
        robotConnected = false;

        if (!connected) {
          clearTimeout(connectTimer);
          resolve(false);
        }
      });

      robotSocket.on("close", () => {
        robotConnected = false;
      });
    });
  });

  // ==============================================
  // 【TCP模式】mode=1   能发 MoveJ！
  // ==============================================
  ipcMain.handle("robot:setTcpMode", async () => {
    if (!robotSocket || !robotConnected) return false;
    robotSocket.write("RequestControl()\r\n");
    console.log(" 发送：切换远程控制模式 mode=1（可发指令移动）");
    return true;
  });

  // ==============================================
  // 【在线模式专用】清除报警
  // ==============================================
  ipcMain.handle("robot:clearError", async () => {
    if (!robotSocket || !robotConnected) return false;
    robotSocket.write("ClearError()\r\n");
    console.log("  发送：清除报警");
    return true;
  });

  // ==============================================
  // 【在线模式专用】上使能
  // ==============================================
  ipcMain.handle("robot:enable", async () => {
    if (!robotSocket || !robotConnected) return false;
    robotSocket.write("EnableRobot()\r\n");
    console.log(" 发送：上使能");
    return true;
  });

  // ==============================================
  // 【在线模式专用】 下使能
  // ==============================================
  ipcMain.handle("robot:disable", async () => {
    if (!robotSocket || !robotConnected) return false;
    robotSocket.write("DisableRobot()\r\n");
    console.log(" 发送：下使能");
    return true;
  });

  // ==============================================
  // 发送自定义指令（MoveJoint 走这里）
  // ==============================================
  ipcMain.handle("robot:send", async (_, cmd) => {
    if (!robotSocket || !robotConnected || !cmd)
      return {
        ok: false,
        reply: "robot not connected",
      };

    return new Promise((resolve) => {
      let done = false;

      const onData = (data) => {
        const msg = data.toString().trim();
        console.log("[机器人消息]", msg);

        getMainWindow()?.webContents.send("robot:message", msg);

        if (!done && msg.includes(cmd.split("(")[0])) {
          done = true;
          robotSocket.off("data", onData);
          resolve({
            ok: msg.startsWith("0,"),
            reply: msg,
          });
        }
      };

      robotSocket.on("data", onData);
      console.log("发送指令：", cmd);
      robotSocket.write(cmd + "\r\n");

      setTimeout(() => {
        if (!done) {
          done = true;
          robotSocket.off("data", onData);
          resolve({
            ok: false,
            reply: "timeout: robot no response",
          });
        }
      }, 2000);
    });
  });

  // ==============================================
  // 断开连接
  // ==============================================
  ipcMain.handle("robot:disconnect", async () => {
    if (robotSocket) robotSocket.destroy();
    if (feedbackSocket) feedbackSocket.destroy();

    robotSocket = null;
    feedbackSocket = null;
    robotConnected = false;

    console.log("❌ 已断开连接");
    return true;
  });

  // ==============================================
  // 扫描设备
  // ==============================================
  ipcMain.handle("robot:scan", async (_, port = DASH_PORT) => {
    return new Promise((resolve) => {
      const deviceList = [];
      const networkPrefix = getLocalNetworkPrefix();
      let finishedCount = 0;
      const total = 254;

      console.log("\n🚀 开始扫描网段：" + networkPrefix + "1~254");

      for (let i = 1; i <= total; i++) {
        const ip = networkPrefix + i;
        const sockDash = new net.Socket();
        sockDash.setTimeout(240);
        let recvStr = "";

        const devItem = {
          ip: ip,
          devName: "未命名设备",
          model: "--",
          firmware: "--",
        };
        let itemIndex = -1;

        sockDash.on("connect", () => {
          sockDash.write("GetDeviceName\r\n");
          itemIndex = deviceList.push(devItem) - 1;
          getRobotModel(ip).then((modelName) => {
            if (itemIndex >= 0) deviceList[itemIndex].model = modelName;
          });
        });

        sockDash.on("data", (buf) => {
          recvStr += buf.toString();
          if (recvStr.includes("OK,")) {
            const name = recvStr.split("OK,")[1]?.trim() || "";
            devItem.devName = name || "未命名设备";
          }
        });

        sockDash.on("timeout", () => sockDash.destroy());
        sockDash.on("error", () => sockDash.destroy());
        sockDash.on("close", () => {
          finishedCount++;
          if (finishedCount >= total) {
            console.log("🏁 扫描完成");
            resolve(deviceList);
          }
        });

        sockDash.connect(port, ip);
      }
    });
  });

  // ==============================================
  //  连接 手势感应 TCP Server（Python项目）
  // ==============================================
  ipcMain.handle("gesture:connect", async (_, ip, port) => {
    return new Promise((resolve) => {
      if (gestureSocket) gestureSocket.destroy();

      gestureSocket = new net.Socket();
      let connected = false;

      const timer = setTimeout(() => {
        if (!connected) {
          gestureSocket.destroy();
          gestureConnected = false;
          resolve(false);
        }
      }, 3000);

      gestureSocket.connect(port, ip, () => {
        connected = true;
        clearTimeout(timer);
        gestureConnected = true;
        console.log("  手势 TCP 连接成功：", ip, port);

        // 监听手势数据
        gestureSocket.on("data", (data) => {
          const gestureStr = data.toString().trim();
          console.log("[手势数据]", gestureStr);

          // 把数据发给前端 Vue → 控制机械臂
          getMainWindow()?.webContents.send("gesture:data", gestureStr);
        });

        resolve(true);
      });

      gestureSocket.on("error", (err) => {
        console.log("手势 TCP 错误：", err.message);
        gestureConnected = false;
        if (!connected) resolve(false);
      });

      gestureSocket.on("close", () => {
        gestureConnected = false;
      });
    });
  });

  // ==============================================
  //  断开手势 TCP
  // ==============================================
  ipcMain.handle("gesture:disconnect", () => {
    if (gestureSocket) gestureSocket.destroy();
    gestureSocket = null;
    gestureConnected = false;
    console.log(" 手势 TCP 已断开");
    return true;
  });
}

//StartDrag 机器人进入关节拖拽模式 立即指令
ipcMain.handle("gesture:startDrag", () => {
  if (gestureConnected) {
    gestureSocket.write("StartDrag\r\n");
  }
});

//StopDrag 机器人退出拖拽模式 立即指令
ipcMain.handle("gesture:stopDrag", () => {
  if (gestureConnected) {
    gestureSocket.write("StopDrag\r\n");
  }
});



function startFeedback(ip) {
  if (feedbackSocket) feedbackSocket.destroy();

  feedbackBuffer = Buffer.alloc(0);
  feedbackSocket = new net.Socket();

  feedbackSocket.connect(30005, ip, () => {
    console.log("已连接实时反馈端口 30005");
  });

  feedbackSocket.on("data", (chunk) => {
    feedbackBuffer = Buffer.concat([feedbackBuffer, chunk]);

    while (feedbackBuffer.length >= 1440) {
      const packet = feedbackBuffer.subarray(0, 1440);
      feedbackBuffer = feedbackBuffer.subarray(1440);

      const qActual = [];
      for (let i = 0; i < 6; i++) {
        qActual.push(Number(packet.readDoubleLE(432 + i * 8).toFixed(3)));
      }

      console.log("实时关节角度 QActual:", qActual);
      getMainWindow()?.webContents.send("robot:feedback", {
        qActual,
        timestamp: Date.now(),
      });
    }
  });

  feedbackSocket.on("error", (err) => {
    console.log("反馈端口错误:", err.message);
  });

  feedbackSocket.on("close", () => {
    console.log("反馈端口已断开");
  });
}

function getRobotModel(ip) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(400);
    let buffer = Buffer.from([]);

    sock.on("data", (buf) => {
      buffer = Buffer.concat([buffer, buf]);
      if (buffer.length >= 1032) {
        const typeCode = buffer.readUInt8(1031);
        console.log("机型类型码:", typeCode);
        const model = ROBOT_TYPE_MAP[typeCode] || `未知(${typeCode})`;
        sock.destroy();
        resolve(model);
      }
    });

    sock.on("close", () => resolve("--"));
    sock.on("error", () => resolve("--"));
    sock.connect(REAL_DATA_PORT, ip);
  });
}

function getLocalNetworkPrefix() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        const parts = iface.address.split(".");
        return `${parts[0]}.${parts[1]}.${parts[2]}.`;
      }
    }
  }
  return "192.168.1.";
}

module.exports = { registerIPC };
