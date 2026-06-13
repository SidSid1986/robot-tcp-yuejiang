<template>
  <div class="control-panel">
    <!-- 👇 这里改成了 加减号精细控制，去掉了滑动条 -->
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
// ✅ 新：发送 位姿Pose 给机器人（直线运动 MovL）
// ==============================================
const sendMovePoseToRobot = async (pose) => {
  if (!window.electronAPI) return

  const x = parseFloat(pose.x.toFixed(2));
  const y = parseFloat(pose.y.toFixed(2));
  const z = parseFloat(pose.z.toFixed(2));
  const rx = parseFloat(pose.rx.toFixed(1));
  const ry = parseFloat(pose.ry.toFixed(1));
  const rz = parseFloat(pose.rz.toFixed(1));

  // ✅ 越疆官方指令：MovL 直线运动（笛卡尔）
  const cmd = `MovL(pose={${x},${y},${z},${rx},${ry},${rz}},a=20,v=20)`;

  console.log("发送Pose:", pose);
  console.log("官方指令:", cmd);

  const res = await window.electronAPI.sendRobotCmd(cmd);
  console.log("机器人返回:", res);
}

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
  await window.electronAPI.MoveJog();
  console.log("✅ 已完全停止！");
};





// 手势实时控制 —— 100% 按你的按钮逻辑  
// const handleConnectGesture = async () => {
//   stopAutoMove.value = false;
//   let isMoving = false;

//   // ==================== 配置
//   const SCALE = 0.5;
//   const MAX_Y = 150;
//   const MIN_Y = -300;
//   const SMOOTH_FACTOR = 0.3;
//   const MIN_MOVE = 0.5;
//   const COOLDOWN = 150;

//   // ==================== 内部状态
//   let basePose = null;
//   let lastX = 0;
//   let lastSendTime = 0;

//   await window.electronAPI.connectGesture("192.168.6.123", 5000);

//   window.electronAPI.onGestureData(async (dataStr) => {
//     try {
//       const data = JSON.parse(dataStr);
//       const now = Date.now();

//       if (now - lastSendTime < COOLDOWN) return;
//       if (isMoving || stopAutoMove.value) return;

//       const rawX = data.x;
//       const smoothX = lastX + (rawX - lastX) * SMOOTH_FACTOR;
//       lastX = smoothX;

//       const dxReal = -smoothX * SCALE;
//       if (Math.abs(dxReal) < MIN_MOVE) return;

//       isMoving = true;
//       lastSendTime = now;
//       if (!basePose) {
//         const cp = await window.electronAPI.getRobotPose();
//         if (!cp) { isMoving = false; return; }
//         basePose = { ...cp };
//       }

//       let targetY = basePose.y + dxReal;
//       if (targetY > MAX_Y) targetY = MAX_Y;
//       if (targetY < MIN_Y) targetY = MIN_Y;

//       const targetPose = {
//         x: basePose.x,
//         y: targetY,
//         z: basePose.z,
//         rx: basePose.rx,
//         ry: basePose.ry,
//         rz: basePose.rz,
//       };


//       await sendMovePoseToRobot(targetPose);

//       basePose.y = targetY;

//     } catch (err) {
//       console.error("手势错误", err);
//     } finally {
//       setTimeout(() => isMoving = false, 50)
//     }
//   });
// };

/**
 * 手势实时双轴控制
 * 手势X → J1旋转左右；手势Y → J2俯仰前后
 * 纯关节增量控制，无逆解、无位姿换算，丝滑无奇异点
 */
const handleConnectGesture = async () => {
  stopAutoMove.value = false;
  let isMoving = false;

  // ==================== 配置参数
  const SCALE_X = 0.5;             // X手势→J1度数灵敏度
  const SCALE_Y = 0.5;             // Y手势→J2度数灵敏度
  const SMOOTH_FACTOR = 0.15;      // 低滤波，响应快不抖动
  const MIN_MOVE = 0.2;            // 最小移动死区，微小手势不触发运动
  const COOLDOWN = 100;            // 指令发送间隔ms

  // ==================== 状态缓存
  let baseJoints = null;
  let lastX = 0;
  let lastY = 0;
  let lastSendTime = 0;

  await window.electronAPI.connectGesture("192.168.6.123", 5000);

  window.electronAPI.onGestureData(async (dataStr) => {
    try {
      const data = JSON.parse(dataStr);
      const now = Date.now();

      // 冷却节流+运动锁判断
      if (now - lastSendTime < COOLDOWN) return;
      if (isMoving || stopAutoMove.value) return;

      // 手势一阶指数平滑滤波
      const rawX = data.x;
      const rawY = data.y;
      const smoothX = lastX + (rawX - lastX) * SMOOTH_FACTOR;
      const smoothY = lastY + (rawY - lastY) * SMOOTH_FACTOR;
      lastX = smoothX;
      lastY = smoothY;

      // 换算成关节角度增量（度）
      const dJ1 = -smoothX * SCALE_X;
      const dJ2 = -smoothY * SCALE_Y;

      // 双轴都小于死区则跳过发送
      if (Math.abs(dJ1) < MIN_MOVE && Math.abs(dJ2) < MIN_MOVE) return;

      isMoving = true;
      lastSendTime = now;

      // 首次抓取基准关节角度（仅一次）
      if (!baseJoints) {
        const joints = await window.electronAPI.getRobotAngle();
        if (!joints || joints.length < 6) {
          console.error("❌ 获取初始关节角度失败");
          isMoving = false;
          return;
        }
        baseJoints = [...joints];
        console.log("✅ 基准关节初始化完成：", baseJoints);
        isMoving = false;
        return;
      }

      // 增量叠加：J1叠加X增量，J2叠加Y增量，其余关节保持不变
      const targetJoints = baseJoints.map((val, idx) => {
        if (idx === 0) return val + dJ1;
        if (idx === 1) return val + dJ2;
        return val;
      });

      // 关节角度限位校验
      let withinBounds = true;
      for (let i = 0; i < targetJoints.length; i++) {
        const degMin = joints.value[i].min * 180 / Math.PI;
        const degMax = joints.value[i].max * 180 / Math.PI;
        if (targetJoints[i] < degMin || targetJoints[i] > degMax) {
          console.warn(`⚠️ J${i + 1} 角度越限：${targetJoints[i].toFixed(2)}°`);
          withinBounds = false;
          break;
        }
      }
      if (!withinBounds) {
        isMoving = false;
        return;
      }

      // 组装MovJ关节运动指令
      const jArr = targetJoints.map(v => v.toFixed(1));
      const cmd = `MovJ(joint={${jArr.join(",")}},a=20,v=20)`;
      const res = await window.electronAPI.sendRobotCmd(cmd);

      console.log("📤 双轴手势下发", {
        dJ1: dJ1.toFixed(2),
        dJ2: dJ2.toFixed(2),
        targetJoints: jArr
      });
      console.log("🤖 机器人回复：", res);

    } catch (err) {
      console.error("手势控制异常：", err);
    } finally {
      setTimeout(() => isMoving = false, 50);
    }
  });
};





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