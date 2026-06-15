<template>
  <div class="control-panel">
    <!--  加减号精细控制，去掉了滑动条 -->
    <div v-for="(joint, index) in joints" :key="index" class="slider-container">
      <label>{{ joint.label }}</label>

      <!-- 减号按钮 -->
      <el-button size="small" @click="stepJoint(index, -0.02)">−</el-button>

      <!-- 中间显示当前值 -->
      <span class="value-text">{{ Number(jointValues[index]).toFixed(2) }} rad</span>

      <!-- 加号按钮 -->
      <el-button size="small" @click="stepJoint(index, 0.02)">+</el-button>
    </div>

    <!-- 夹爪控制 -->

    <div class="button-area">
      <el-button @click="robotReset" type="warning">
        <Refresh style="width: 1em; height: 1em; margin-right: 8px" />
        机械臂复位
      </el-button>

      <!-- <el-button @click="startDemo" type="primary" style="margin-left: 10px">
        <VideoPlay style="width: 1em; height: 1em; margin-right: 8px" />
        开始演示
      </el-button> -->
      <el-button @click="handleMoveLeft" type="warning">
        <Refresh style="width: 1em; height: 1em; margin-right: 8px" />
        向左移动 X-
      </el-button>
      <el-button @click="handleMoveRight" type="primary">
        向右移动 X-
      </el-button>

      <!--  停止按钮（官方指令）-->
      <el-button @click="stopRobotMove" type="danger">
        停止运动
      </el-button>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from "vue";
import { Refresh, VideoPlay } from "@element-plus/icons-vue"; // 引入刷新图标
import { ElButton } from "element-plus"; // 引入 Element Plus 按钮组件
import demoTrajectory from "./demo-trajectory.json";

const props = defineProps({
  jointArr: {
    type: Array,
    default: () => [],
  },
  robotConnected: {
    type: Boolean,
    default: false,
  },
});

// 自动移动停止标志
const stopAutoMove = ref(false);

// 定义组件向父级传递的事件
const emit = defineEmits(["joint-change", "gripper-change", "reset-all"]);
// 当前正在插值的关节值
const currentJointValues = ref([0.0, 0.0, 1.57, 0.0, 1.57, 0.0]);

// 目标关节值（当前帧的目标）
const targetJointValues = ref([0.0, 0.0, 1.57, 0.0, 1.57, 0.0]);

// 当前轨迹帧索引
const currentFrameIndex = ref(0);

// 插值因子（越小越平滑，比如 0.02 ~ 0.05）
const lerpFactor = 0.03;

// 动画循环 ID（用于取消）
let animationFrameId = null;

// 定义所有可控制的关节信息

const joints = ref([
  {
    name: "joint1",
    label: "joint1",
    min: -6.28,
    max: 6.28,
    step: 0.01,
  },
  {
    name: "joint2",
    label: "joint2",
    min: -6.28,
    max: 6.28,
    step: 0.01,
  },
  {
    name: "joint3",
    label: "joint3",
    min: -6.28,
    max: 6.28,
    step: 0.01,
  },
  { name: "joint4", label: "joint4", min: -6.28, max: 6.28, step: 0.01 },
  { name: "joint5", label: "joint5", min: -6.28, max: 6.28, step: 0.01 },
  { name: "joint6", label: "joint6", min: -6.28, max: 6.28, step: 0.01 },
]);

// 当前各个关节的值，双向绑定到滑动条
const jointValues = ref(
  [
    0.0, // shoulder_joint
    0.0, // upperArm_joint
    0.0, // foreArm_joint
    0.0, // wrist1_joint
    0.0, // wrist2_joint
    0.0, // wrist3_joint
  ].map(Number)
);

// 所有关节的初始位置定义，用于复位时传递给父组件

const INITIAL_POSITIONS = {
  joint1: 0.0,
  joint2: 0.0,
  joint3: 0.0,
  joint4: 0.0,
  joint5: 0.0,
  joint6: 0.0,
  joint7: 0.0, // 夹爪关节
};

let isDemoRunning = ref(false); // 防止重复点击

//机械臂复位功能：将所有关节重置为初始角度，夹爪闭合
const robotReset = () => {
  const targetValues = [0, 0, 0, 0, 0, 0];

  if (props.robotConnected) {
    sendMoveToRobot(targetValues);
    return;
  }

  jointValues.value = targetValues;

  emit("joint-change", {
    jointValues: targetValues,
    fromFeedback: true,
  });
};

// ==============================================
// ✅ 已修复：弧度 → 角度 正确发送
// ==============================================
const sendMoveToRobot = async (jointValuesRad) => {
  if (!window.electronAPI) return

  // 弧度 → 角度
  const j1 = parseFloat((jointValuesRad[0] * 180 / Math.PI).toFixed(1));
  const j2 = parseFloat((jointValuesRad[1] * 180 / Math.PI).toFixed(1));
  const j3 = parseFloat((jointValuesRad[2] * 180 / Math.PI).toFixed(1));
  const j4 = parseFloat((jointValuesRad[3] * 180 / Math.PI).toFixed(1));
  const j5 = parseFloat((jointValuesRad[4] * 180 / Math.PI).toFixed(1));
  const j6 = parseFloat((jointValuesRad[5] * 180 / Math.PI).toFixed(1));

  const cmd = `MovJ(joint={${j1},${j2},${j3},${j4},${j5},${j6}},a=20,v=20)`;

  console.log("关节弧度:", jointValuesRad);
  console.log("机器人角度:", [j1, j2, j3, j4, j5, j6]);
  console.log("官方指令:", cmd);

  const res = await window.electronAPI.sendRobotCmd(cmd);
  console.log("机器人返回:", res);
}


// ==============================================
//  发送 位姿Pose 给机器人（直线运动 MovL）
// ==============================================
const sendMovePoseToRobot = async (pose) => {
  if (!window.electronAPI) return

  const x = parseFloat(pose.x.toFixed(2));
  const y = parseFloat(pose.y.toFixed(2));
  const z = parseFloat(pose.z.toFixed(2));
  const rx = parseFloat(pose.rx.toFixed(1));
  const ry = parseFloat(pose.ry.toFixed(1));
  const rz = parseFloat(pose.rz.toFixed(1));

  // a加速度提升，消除频繁启停卡顿
  const cmd = `MovL(pose={${x},${y},${z},${rx},${ry},${rz}},a=45,v=25)`;

  console.log("发送Pose:", pose);
  console.log("官方指令:", cmd);

  const res = await window.electronAPI.sendRobotCmd(cmd);
  console.log("机器人返回:", res);
}


/**
 * 越疆官方点动指令封装
 * @param {string} axisID 轴标识，"J1" / "J1+" / "J1-" / "" 空字符串停止所有
 */
const sendMoveJog = async (param) => {
  if (!window.electronAPI || !props.robotConnected) return null;
  const res = await window.electronAPI.MoveJog(param);
  console.log("Jog调用返回：", res);
  return res;
};



//更新某个关节的角度
const updateJoint = (jointName, value, jointValues) => {
  console.log("所有轴的数据", jointValues);
  sendMoveToRobot(jointValues)
};

//平滑插值执行函数

const smoothDemoLoop = () => {
  if (!isDemoRunning.value) return;

  if (currentFrameIndex.value < demoTrajectory.length) {
    targetJointValues.value = demoTrajectory[currentFrameIndex.value];
  } else {
    console.log("码垛操作完成（所有轨迹帧执行完毕）");
    isDemoRunning.value = false;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    return;
  }

  const newJointValues = currentJointValues.value.map((current, i) => {
    const target = targetJointValues.value[i];
    return current + (target - current) * lerpFactor;
  });

  emit("joint-change", {
    jointValues: newJointValues,
  });

  currentJointValues.value = newJointValues;

  const isClose = targetJointValues.value.every(
    (t, i) => Math.abs(t - newJointValues[i]) < 0.01
  );

  if (isClose) {
    currentFrameIndex.value++;
  }

  animationFrameId = requestAnimationFrame(smoothDemoLoop);
};

const stepJoint = (index, step) => {
  const targetValues = [...jointValues.value];
  let val = targetValues[index] + step;
  val = Math.max(joints.value[index].min, Math.min(joints.value[index].max, val));
  targetValues[index] = val;

  // ==============================================
  //  核心逻辑：已连接 → 只发指令，不修改页面
  //  未连接 → 修改页面，本地演示
  // ==============================================
  if (props.robotConnected) {
    // 联机：只发送给机器人，页面模型等待机器人自动反馈
    sendMoveToRobot(targetValues);
  } else {
    // 脱机：本地修改页面模型
    jointValues.value = targetValues;
    emit("joint-change", {
      jointValues: targetValues.map(Number),
      fromFeedback: true,
    });
  }
};

//开始演示 - 逐步改变关节值到目标位置
const startDemo = (jointArr) => {
  if (isDemoRunning.value) return;

  const targetPositions = jointArr;

  const isAtTarget = jointValues.value.every(
    (current, index) => Math.abs(current - targetPositions[index]) < 0.01
  );

  if (isAtTarget) {
    console.log("已经在目标位置，无需移动");
    return;
  }

  isDemoRunning.value = true;
  currentFrameIndex.value = 0;

  smoothDemoLoopToTarget(targetPositions);
};

//平滑插值到目标位置
const smoothDemoLoopToTarget = async (targetPositions) => {
  const lerpFactor = 0.05;
  const stepSize = 0.1;

  const animate = () => {
    if (!isDemoRunning.value) return;

    let allReached = true;

    const newJointValues = jointValues.value.map((current, index) => {
      const target = targetPositions[index];
      const difference = target - current;

      if (Math.abs(difference) < stepSize) {
        return target;
      }

      allReached = false;

      if (difference > 0) {
        return Math.min(current + stepSize, target);
      } else {
        return Math.max(current - stepSize, target);
      }
    });

    jointValues.value = newJointValues;

    emit("joint-change", {
      jointValues: newJointValues.map(Number),
    });

    sendMoveToRobot(newJointValues);

    if (allReached) {
      console.log("✅ 已到达目标位置");
      isDemoRunning.value = false;
    } else {
      requestAnimationFrame(animate);
    }
  };

  animate();
};


const stopRobotMove = async () => {
  stopAutoMove.value = true;
  await window.electronAPI.MoveJog("");
  stopServoLoop?.();
  console.log("✅ Servo伺服跟随 + 点动运动 全部强制停止");
};

//=====================================ServoP指令==================== 

const sendServoPCycle = async (args) => {
  const { stopAutoMove, stopServoLoop, servoRunning, latestTargetPose, SERVO_T, AHEADTIME, GAIN, sendRobotCmd } = args;
  if (stopAutoMove.value) {
    stopServoLoop();
    return;
  }
  if (!servoRunning || !latestTargetPose) return;

  const p = latestTargetPose;
  const x = parseFloat(p.x.toFixed(2));
  const y = parseFloat(p.y.toFixed(2));
  const z = parseFloat(p.z.toFixed(2));
  const rx = parseFloat(p.rx.toFixed(1));
  const ry = parseFloat(p.ry.toFixed(1));
  const rz = parseFloat(p.rz.toFixed(1));

  const cmd = `ServoP(${x},${y},${z},${rx},${ry},${rz},t=${SERVO_T},aheadtime=${AHEADTIME},gain=${GAIN});`;
  console.log("[ServoP完整指令]", cmd);
  try {
    const res = await sendRobotCmd(cmd);
    console.log("[ServoP返回结果]", res);
    if (!res.ok || !res.reply.startsWith("0,")) {
      console.error("[ServoP下发失败，停止跟随]", res);
      stopServoLoop();
    }
  } catch (err) {
    console.error("[ServoP调用异常]", err);
    stopServoLoop();
  }
}

const handleConnectGesture = async () => {
  stopAutoMove.value = false;

  // ========== 柔性参数 ==========
  const SMOOTH_FACTOR = 0.35;
  const MIN_MOVE = 0.12;
  const SERVO_PERIOD = 30;       // 固定下发周期，绝对均匀
  const SERVO_T = 0.05;
  const AHEADTIME = 80;
  const GAIN = 200;
  const STEP_SCALE_X = 1.0;
  const STEP_SCALE_Z = 1.0;
  const MAX_SPEED_X = 6.0;       // 最大速度 mm/帧
  const MAX_SPEED_Z = 6.0;
  const ACCEL_X = 1.0;           // 加速度 mm/帧²，越大起步越快
  const ACCEL_Z = 1.0;

  const LIMIT = {
    xMin: -160, xMax: 500,
    yMin: 100, yMax: 600,
    zMin: 200, zMax: 580,
    rxMin: -180, rxMax: 180,
    ryMin: -90, ryMax: 90,
    rzMin: -180, rzMax: 180,
  };

  // ========== 状态变量 ==========
  let basePose = null;
  let servoTimer = null;
  let servoRunning = false;
  let latestTargetPose = null;

  // 坐标状态
  let xCurrent = 0;
  let zCurrent = 0;
  // 当前实际速度（加减速平滑用）
  let currVelX = 0;
  let currVelZ = 0;
  // 滤波后期望速度输入
  let targetVelX = 0;
  let targetVelZ = 0;

  let lastSentX = null;
  let lastSentZ = null;

  await window.electronAPI.connectGesture("192.168.6.123", 5000);
  console.log("[手势] 手势TCP连接成功");

  const stopServoLoop = () => {
    console.log("[Servo] 停止手势随动，保留当前坐标");
    servoRunning = false;
    // 速度归零，下次启动从0加速，无冲击
    currVelX = 0;
    currVelZ = 0;
    targetVelX = 0;
    targetVelZ = 0;
    if (servoTimer) {
      clearInterval(servoTimer);
      servoTimer = null;
    }
  };

  const cycleArgs = {
    stopAutoMove,
    stopServoLoop,
    servoRunning,
    latestTargetPose,
    SERVO_T,
    AHEADTIME,
    GAIN,
    sendRobotCmd: window.electronAPI.sendRobotCmd.bind(window.electronAPI)
  };

  // ========== 核心：固定时钟匀速插补下发 ==========
  const servoTick = () => {
    if (!servoRunning || !basePose) return;

    // 1. 速度平滑逼近：按加速度逐步追平目标速度，正负对称
    if (currVelX < targetVelX) {
      currVelX = Math.min(currVelX + ACCEL_X, targetVelX);
    } else if (currVelX > targetVelX) {
      currVelX = Math.max(currVelX - ACCEL_X, targetVelX);
    }
    if (currVelZ < targetVelZ) {
      currVelZ = Math.min(currVelZ + ACCEL_Z, targetVelZ);
    } else if (currVelZ > targetVelZ) {
      currVelZ = Math.max(currVelZ - ACCEL_Z, targetVelZ);
    }

    // 2. 计算本帧位移，更新坐标
    xCurrent += currVelX;
    zCurrent -= currVelZ; // 保持你原有方向映射：y正Z上升，y负Z下降

    // 3. 硬限位
    xCurrent = Math.max(LIMIT.xMin, Math.min(LIMIT.xMax, xCurrent));
    zCurrent = Math.max(LIMIT.zMin, Math.min(LIMIT.zMax, zCurrent));

    // 4. 重复点位过滤，极小变化不发指令
    if (
      lastSentX !== null &&
      Math.abs(xCurrent - lastSentX) < 0.01 &&
      Math.abs(zCurrent - lastSentZ) < 0.01
    ) {
      return;
    }

    const targetY = basePose.y;
    const rx = basePose.rx;
    const ry = basePose.ry;
    const rz = basePose.rz;

    latestTargetPose = { x: xCurrent, y: targetY, z: zCurrent, rx, ry, rz };
    cycleArgs.latestTargetPose = latestTargetPose;

    lastSentX = xCurrent;
    lastSentZ = zCurrent;

    // 5. 固定频率下发，时序绝对均匀
    sendServoPCycle(cycleArgs);
  };

  // ========== 手势数据回调：只更新期望速度 ==========
  window.electronAPI.onGestureData(async (dataStr) => {
    try {
      const data = JSON.parse(dataStr);
      if (data.is_open === true) {
        stopServoLoop();
        return;
      }
      if (stopAutoMove.value) {
        stopServoLoop();
        return;
      }

      const rawX = data.x ?? 0;
      const rawY = data.y ?? 0;
      const absX = Math.abs(rawX);
      const absY = Math.abs(rawY);

      // 死区判断
      if (absX < MIN_MOVE && absY < MIN_MOVE) {
        // 目标速度设为0，让机械臂平滑减速到停止，不硬切
        targetVelX = 0;
        targetVelZ = 0;
        return;
      }

      // 首次启动抓基准位+启定时器，只执行一次
      if (!basePose) {
        console.log("[手势] 首次启动，获取初始位姿");
        const currPose = await window.electronAPI.getRobotPose();
        if (!currPose) {
          console.error("[手势] 获取位姿失败");
          return;
        }
        basePose = { ...currPose };
        xCurrent = basePose.x;
        zCurrent = basePose.z;
        lastSentX = xCurrent;
        lastSentZ = zCurrent;
      }

      // 滑动滤波
      targetVelX = targetVelX + (rawX * STEP_SCALE_X - targetVelX) * SMOOTH_FACTOR;
      targetVelZ = targetVelZ + (rawY * STEP_SCALE_Z - targetVelZ) * SMOOTH_FACTOR;

      // 最大速度限幅
      targetVelX = Math.max(-MAX_SPEED_X, Math.min(MAX_SPEED_X, targetVelX));
      targetVelZ = Math.max(-MAX_SPEED_Z, Math.min(MAX_SPEED_Z, targetVelZ));

      // 启动运行状态与定时器
      if (!servoRunning) {
        servoRunning = true;
        cycleArgs.servoRunning = servoRunning;
        if (!servoTimer) {
          servoTimer = setInterval(servoTick, SERVO_PERIOD);
          console.log("[Servo] 匀速插补定时器启动");
        }
      }

    } catch (err) {
      console.error("手势全局异常:", err);
      stopServoLoop();
    }
  });
};

// const handleConnectGesture = async () => {
//   stopAutoMove.value = false;

//   // 柔性化参数，减小刚性冲击
//   const SMOOTH_FACTOR = 0.3;
//   const MIN_MOVE = 0.3;
//   const SERVO_PERIOD = 30;
//   const SERVO_T = 0.05;
//   const AHEADTIME = 80;
//   const GAIN = 200;        // 官方下限，柔性跟随，减小拽动冲击
//   const STEP_SCALE_X = 1.0;// X轴缩放比例
//   const STEP_SCALE_Z = 1.0;// Z轴缩放比例
//   const MAX_STEP_X = 5;    // X单帧最大位移
//   const MAX_STEP_Z = 5;    // Z单帧最大位移

//   const LIMIT = {
//     xMin: -160, xMax: 500,
//     yMin: 100, yMax: 600,
//     zMin: 200, zMax: 580,
//     rxMin: -180, rxMax: 180,
//     ryMin: -90, ryMax: 90,
//     rzMin: -180, rzMax: 180,
//   };

//   let lastDx = 0;   // X轴滤波缓存
//   let lastDy = 0;   // Z轴滤波缓存
//   let justPaused = false;
//   let basePose = null;
//   let servoTimer = null;
//   let servoRunning = false;
//   let latestTargetPose = null;
//   let xCurrent = 0;
//   let zCurrent = 0;
//   let lastSendStamp = 0;

//   await window.electronAPI.connectGesture("192.168.6.123",5000);
//   console.log("[手势] 手势TCP连接成功");

//   const stopServoLoop = () => {
//     console.log("[Servo] 执行停止循环，清空定时器与基准位");
//     servoRunning = false;
//     if (servoTimer) {
//       clearInterval(servoTimer);
//       servoTimer = null;
//     }
//     basePose = null;
//     latestTargetPose = null;
//     xCurrent = 0;
//     zCurrent = 0;
//     lastDx = 0;
//     lastDy = 0;
//     justPaused = false;
//     lastSendStamp = 0;
//   };

//   const cycleArgs = {
//     stopAutoMove,
//     stopServoLoop,
//     servoRunning,
//     latestTargetPose,
//     SERVO_T,
//     AHEADTIME,
//     GAIN,
//     sendRobotCmd: window.electronAPI.sendRobotCmd.bind(window.electronAPI)
//   };

//   window.electronAPI.onGestureData(async (dataStr) => {
//     try {
//       const data = JSON.parse(dataStr);
//       if (data.is_open === true) {
//         stopServoLoop();
//         basePose = null;
//         return;
//       }
//       if (stopAutoMove.value) {
//         stopServoLoop();
//         return;
//       }

//       // X、Y任一轴有效就持续运行
//       const absX = Math.abs(data.x ?? 0);
//       const absY = Math.abs(data.y ?? 0);
//       if (absX < MIN_MOVE && absY < MIN_MOVE) {
//         if (!justPaused && servoTimer) {
//           console.log("[手势] 手势静止，暂停Servo下发定时器");
//           justPaused = true;
//           clearInterval(servoTimer);
//           servoTimer = null;
//         }
//         return;
//       }

//       if (justPaused) {
//         lastDx = data.x ?? 0;
//         lastDy = data.y;
//         justPaused = false;
//         if (!servoTimer) {
//           servoTimer = setInterval(() => sendServoPCycle(cycleArgs), SERVO_PERIOD);
//           console.log("[Servo] 定时器重建，持续下发指令");
//         }
//       }

//       // X轴滑动平均滤波
//       lastDx = lastDx + ((data.x ?? 0) - lastDx) * SMOOTH_FACTOR;
//       // Z轴原有滤波不变
//       lastDy = lastDy + (data.y - lastDy) * SMOOTH_FACTOR;

//       if (!basePose) {
//         console.log("[手势] 新拖动起始，同步获取机械臂实时位姿");
//         const currPose = await window.electronAPI.getRobotPose();
//         if (!currPose) {
//           console.error("[手势] 获取位姿失败");
//           return;
//         }
//         basePose = { ...currPose };
//         xCurrent = basePose.x;
//         zCurrent = basePose.z;
//         servoRunning = true;
//         cycleArgs.servoRunning = servoRunning;
//         if (!servoTimer) {
//           servoTimer = setInterval(() => sendServoPCycle(cycleArgs), SERVO_PERIOD);
//           console.log("[Servo] 定时器创建完毕，持续下发指令");
//         }
//       }

//       // 节流对齐30ms下发周期
//       const now = Date.now();
//       if (now - lastSendStamp < SERVO_PERIOD) return;
//       lastSendStamp = now;

//       // ========== X轴位移计算+限幅 ==========
//       let deltaX = lastDx * STEP_SCALE_X;
//       deltaX = Math.max(-MAX_STEP_X, Math.min(MAX_STEP_X, deltaX));
//       // X方向符号，按需 + / - 互换
//       xCurrent += deltaX;
//       // X硬限位
//       xCurrent = Math.max(LIMIT.xMin, Math.min(LIMIT.xMax, xCurrent));

//       // ========== Z轴原有逻辑完全不动 ==========
//       let deltaZ = lastDy * STEP_SCALE_Z;
//       deltaZ = Math.max(-MAX_STEP_Z, Math.min(MAX_STEP_Z, deltaZ));
//       zCurrent -= deltaZ;
//       zCurrent = Math.max(LIMIT.zMin, Math.min(LIMIT.zMax, zCurrent));

//       const targetY = basePose.y;
//       const rx = basePose.rx;
//       const ry = basePose.ry;
//       const rz = basePose.rz;

//       latestTargetPose = {
//         x: xCurrent,
//         y: targetY,
//         z: zCurrent,
//         rx, ry, rz
//       };
//       cycleArgs.latestTargetPose = latestTargetPose;

//       console.log(
//         "手势x值:", lastDx, "X单帧位移:", deltaX, "当前X坐标:", xCurrent,
//         "手势y值:", lastDy, "Z单帧位移:", deltaZ, "当前Z坐标:", zCurrent
//       );

//     } catch (err) {
//       console.error("手势全局异常:", err);
//       stopServoLoop();
//     }
//   });
// };


//=====================================ServoP指令==================== 






//y增加向左最大150，y减少向右最小-300
// 向左移动 = Y 减少（慢速模拟 + 软限位：Y ≤ 150）
const handleMoveLeft = () => {
  stopAutoMove.value = false;
  let isMoving = false;
  const SCALE = 5;    // 超慢速度
  const MIN_Y = 150;   // Y 最小值限制

  const move = async () => {
    if (stopAutoMove.value) return;
    if (isMoving) return;
    isMoving = true;

    try {
      const currentPose = await window.electronAPI.getRobotPose();
      if (!currentPose) return;

      // 只动 Y 轴：减少（向左）
      let targetY = currentPose.y - SCALE;
      if (targetY < MIN_Y) {
        targetY = MIN_Y;
        await stopRobotMove();
      }; // 限位

      const targetPose = {
        x: currentPose.x,        // X 完全不动
        y: targetY,              // 只改 Y
        z: currentPose.z,
        rx: currentPose.rx,
        ry: currentPose.ry,
        rz: currentPose.rz,
      };

      // ==============================================
      // 发送位姿Pose 给机器人（直线运动 MovL）
      // ==============================================
      await sendMovePoseToRobot(targetPose);

      // ==============================================
      // 发送关节给机器人 （IK 解析）
      // ==============================================
      // const joints = await window.electronAPI.ikSolve(targetPose);
      // if (joints) {
      //   sendMoveToRobot(joints);
      // }
    } catch (err) {
      console.error("向左移动错误", err);
    } finally {
      isMoving = false;
      setTimeout(move, 300);
    }
  };

  move();
};
// 向右移动 = Y 增加（慢速模拟 + 软限位：Y ≥ -300）
const handleMoveRight = () => {
  stopAutoMove.value = false;
  let isMoving = false;
  const SCALE = 1;   // 超慢速度
  const MAX_Y = -300;   // Y 最大值限制

  const move = async () => {
    if (stopAutoMove.value) return;
    if (isMoving) return;
    isMoving = true;

    try {
      const currentPose = await window.electronAPI.getRobotPose();
      if (!currentPose) return;

      // 只动 Y 轴：增加（向右）
      let targetY = currentPose.y + SCALE;
      if (targetY > MAX_Y) {
        targetY = MAX_Y;
        await stopRobotMove();
      }; // 限位

      const targetPose = {
        x: currentPose.x,        // X 完全不动
        y: targetY,              // 只改 Y
        z: currentPose.z,
        rx: currentPose.rx,
        ry: currentPose.ry,
        rz: currentPose.rz,
      };

      console.log(targetPose);
      // ==============================================
      // 发送位姿Pose 给机器人（直线运动 MovL）
      // ==============================================
      await sendMovePoseToRobot(targetPose);

      // ==============================================
      // 发送关节给机器人 （IK 解析）
      // ==============================================
      // const joints = await window.electronAPI.ikSolve(targetPose);
      // console.log(joints);
      // if (joints) {
      //   sendMoveToRobot(joints);
      // }
    } catch (err) {
      console.error("向左移动错误", err);
    } finally {
      isMoving = false;
      setTimeout(move, 300);
    }
  };

  move();
};

// 手势断断开
const handleDisconnectGesture = () => {
  window.electronAPI.disconnectGesture();
};

watch(
  () => props.jointArr,
  (newVal) => {
    if (!Array.isArray(newVal) || newVal.length < 6) return;

    jointValues.value = newVal.slice(0, 6).map(Number);

    emit("joint-change", {
      jointValues: jointValues.value,
      fromFeedback: true,
    });
  },
  { deep: true, immediate: true }
);

onMounted(() => {
  handleConnectGesture()
});

onUnmounted(() => {
  handleDisconnectGesture();
});
</script>

<style scoped>
.control-panel {
  padding-top: 4vh;
  background: rgba(245, 245, 245, 0.95);
  height: 100%;
  overflow-y: auto;
  position: relative;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(5px);

  /* border:3px solid red; */
}

.slider-container {
  margin-bottom: 15px;
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  align-items: center;
}

/* 滑动条标签 */
.slider-container label {
  display: block;
  font-weight: bold;
}

/* 数值显示 */
.slider-container span {
  font-size: 0.9em;
  color: #555;
}

/* 按钮区域样式 */
.button-area {
  margin-top: 20px;
}
</style>