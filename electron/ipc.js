/*
 * @Author: Sid Li
 * @Date: 2026-06-04 17:00:25
 * @LastEditors: Sid Li
 * @LastEditTime: 2026-06-13 15:13:53
 * @Description: 远程控制模式（可发MoveJoint）+ 连接 + 使能 + 回原点 + 扫描 + 急停
 */
const { ipcMain, app } = require("electron");
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
  //  清除报警
  // ==============================================
  ipcMain.handle("robot:clearError", async () => {
    if (!robotSocket || !robotConnected) return false;
    robotSocket.write("ClearError()\r\n");
    console.log("  发送：清除报警");
    return true;
  });

  // ==============================================
  //  上使能
  // ==============================================
  ipcMain.handle("robot:enable", async () => {
    if (!robotSocket || !robotConnected) return false;
    robotSocket.write("EnableRobot()\r\n");
    console.log(" 发送：上使能");
    return true;
  });

  // ==============================================
  //   下使能
  // ==============================================
  ipcMain.handle("robot:disable", async () => {
    if (!robotSocket || !robotConnected) return false;
    robotSocket.write("DisableRobot()\r\n");
    console.log(" 发送：下使能");
    return true;
  });

  // 越疆官方标准：点动 + 立即停止
  ipcMain.handle("robot:moveJog", async (event, payload) => {
    if (!robotSocket || !robotConnected) {
      return { code: -1, msg: "未连接机器人" };
    }

    try {
      let cmdSegments = [];

      // 场景1：向前兼容，直接传字符串 axisID（旧调用方式不变）
      if (typeof payload === "string") {
        const axisID = payload.trim();
        if (axisID === "") {
          // 空字符串 → MoveJog() 停止
          cmdSegments = [];
        } else {
          cmdSegments.push(axisID);
        }
      }
      // 场景2：传入对象，完整携带所有可选参数（标准正规用法）
      else if (
        payload &&
        typeof payload === "object" &&
        !Array.isArray(payload)
      ) {
        const { axisID, coordtype, user, tool } = payload;
        if (!axisID || axisID.trim() === "") {
          cmdSegments = [];
        } else {
          cmdSegments.push(axisID.trim());
          if (coordtype !== undefined)
            cmdSegments.push(`coordtype=${coordtype}`);
          if (user !== undefined) cmdSegments.push(`user=${user}`);
          if (tool !== undefined) cmdSegments.push(`tool=${tool}`);
        }
      }

      // 拼接最终指令
      const cmd = cmdSegments.length
        ? `MoveJog(${cmdSegments.join(",")})`
        : "MoveJog()";
      console.log("✅ MoveJog 下发指令：", cmd);
      robotSocket.write(cmd + "\r\n");

      return { code: 0, sendCmd: cmd };
    } catch (err) {
      console.error("❌ MoveJog 发送异常：", err.message);
      return { code: -1, msg: err.message };
    }
  });

  // ==============================================
  // 发送自定义指令（MoveJ）
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

    console.log(" 已断开连接");
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
  //  连接 手势感应 TCP Server
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

  //
  ipcMain.handle("app:get-resources-path", () => {
    try {
      // 打包环境用 process.resourcesPath，稳定不会抛异常
      const resourcesPath = process.resourcesPath;
      console.log("✅ [Electron Main] 返回 resources 路径：", resourcesPath);
      return resourcesPath;
    } catch (error) {
      console.error("❌ [Electron Main] 获取 resources 路径失败：", error);
      const fallbackPath = require("path").join(app.getAppPath(), "resources");
      console.log("⚠️  [Electron Main] 使用降级路径：", fallbackPath);
      return fallbackPath;
    }
  });

  //StartDrag 机器人进入关节拖拽模式 立即指令
  ipcMain.handle("robot:startDrag", () => {
    if (robotConnected) {
      robotSocket.write("StartDrag()\r\n");
    }
  });

  //StopDrag 机器人退出拖拽模式 立即指令
  ipcMain.handle("robot:stopDrag", () => {
    if (robotConnected) {
      robotSocket.write("StopDrag()\r\n");
    }
  });

  // ==============================================
  // ✅ 获取当前末端位姿 (x,y,z,rx,ry,rz)
  // ==============================================
  ipcMain.handle("robot:getPose", async () => {
    if (!robotSocket || !robotConnected) return null;

    return new Promise((resolve) => {
      let done = false;
      const onData = (data) => {
        const msg = data.toString().trim();
        console.log("GetPose原始返回:", msg);
        if (msg.startsWith("0,")) {
          try {
            // 越疆返回格式： 0,{x,y,z,rx,ry,rz},GetPose();
            const match = msg.match(
              /\{([\d\.\-]+),([\d\.\-]+),([\d\.\-]+),([\d\.\-]+),([\d\.\-]+),([\d\.\-]+)\}/,
            );
            if (match) {
              const pose = {
                x: parseFloat(match[1]),
                y: parseFloat(match[2]),
                z: parseFloat(match[3]),
                rx: parseFloat(match[4]),
                ry: parseFloat(match[5]),
                rz: parseFloat(match[6]),
              };
              console.log("✅ 解析成功 当前位姿:", pose);
              resolve(pose);
              done = true;
              robotSocket.off("data", onData);
            }
          } catch (e) {}
        }
      };
      robotSocket.on("data", onData);
      robotSocket.write("GetPose()\r\n");
      setTimeout(() => {
        if (!done) resolve(null);
      }, 1000);
    });
  });

  // ==============================================
  // ✅ 逆解：位姿 → 关节角度 (最重要！)
  // ==============================================
  // 逆解运算：位姿 → 关节角度 【文档标准版】
  ipcMain.handle("robot:ikSolve", async (_, pose) => {
    if (!robotSocket || !robotConnected) return null;

    const { x, y, z, rx, ry, rz } = pose;

    // ==============================================
    // ✅ 官方文档正确格式！！！
    // ==============================================
    const cmd = `InverseKin(${x},${y},${z},${rx},${ry},${rz})\r\n`;

    return new Promise((resolve) => {
      let done = false;
      const onData = (data) => {
        const msg = data.toString().trim();
        console.log("ik返回:", msg);

        // 失败
        if (msg.startsWith("-10000")) {
          console.error("❌ 逆解失败");
          resolve(null);
          done = true;
          robotSocket.off("data", onData);
          return;
        }

        // 成功
        if (msg.startsWith("0,")) {
          try {
            const match = msg.match(
              /\{([\d\.\-]+),([\d\.\-]+),([\d\.\-]+),([\d\.\-]+),([\d\.\-]+),([\d\.\-]+)\}/,
            );
            if (match) {
              const joints = [
                parseFloat(match[1]),
                parseFloat(match[2]),
                parseFloat(match[3]),
                parseFloat(match[4]),
                parseFloat(match[5]),
                parseFloat(match[6]),
              ];
              console.log("✅ 逆解成功:", joints);
              resolve(joints);
            }
          } catch (e) {
            resolve(null);
          }
          done = true;
          robotSocket.off("data", onData);
        }
      };

      robotSocket.on("data", onData);
      robotSocket.write(cmd);

      setTimeout(() => {
        if (!done) resolve(null);
      }, 1000);
    });
  });

  // ==============================================
  // ✅ 获取当前关节角度（度数）GetAngle()
  // ==============================================
  ipcMain.handle("robot:getAngle", async () => {
    if (!robotSocket || !robotConnected) return null;

    return new Promise((resolve) => {
      let done = false;
      const onData = (data) => {
        const msg = data.toString().trim();
        console.log("GetAngle原始返回:", msg);

        // 成功返回格式：0,{0.0,0.0,-90.0,0.0,90.0,0.0},GetAngle()
        if (msg.startsWith("0,")) {
          try {
            const match = msg.match(/\{([^}]+)\}/);
            if (match) {
              // 分割成6个关节角度
              const joints = match[1]
                .split(",")
                .map((v) => parseFloat(v.trim()));

              if (joints.length === 6) {
                console.log("✅ 解析成功 当前关节(度):", joints);
                resolve(joints); // 返回 [J1,J2,J3,J4,J5,J6]
                done = true;
                robotSocket.off("data", onData);
                return;
              }
            }
          } catch (e) {}
        }
      };

      robotSocket.on("data", onData);
      robotSocket.write("GetAngle()\r\n");

      setTimeout(() => {
        if (!done) resolve(null);
      }, 1000);
    });
  });
}

function startFeedback(ip) {
  if (feedbackSocket) feedbackSocket.destroy();

  feedbackBuffer = Buffer.alloc(0);
  feedbackSocket = new net.Socket();

  feedbackSocket.connect(REAL_DATA_PORT, ip, () => {
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

      // console.log("实时关节角度 QActual:", qActual);
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
