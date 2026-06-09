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
// ✅ 越疆官方指令发送函数（只改这里，其他完全不动）
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

  //  越疆官方标准格式
  const cmd = `MovJ(joint={${j1},${j2},${j3},${j4},${j5},${j6}},a=20,v=20)`;

  console.log("关节弧度:", jointValuesRad);
  console.log("机器人角度:", [j1, j2, j3, j4, j5, j6]);
  console.log("官方指令:", cmd);

  const res = await window.electronAPI.sendRobotCmd(cmd);
  console.log("机器人返回:", res);
}


//更新某个关节的角度
 const updateJoint = (jointName, value, jointValues) => {
  console.log("所有轴的数据", jointValues);

  // emit("joint-change", {
  //   jointValues: jointValues.map(Number),
  // });

  sendMoveToRobot(jointValues)
};

//平滑插值执行函数
 
const smoothDemoLoop = () => {
  if (!isDemoRunning.value) return;

  // 获取当前目标帧
  if (currentFrameIndex.value < demoTrajectory.length) {
    targetJointValues.value = demoTrajectory[currentFrameIndex.value];
  } else {
    // 所有帧执行完毕
    console.log("码垛操作完成（所有轨迹帧执行完毕）");
    isDemoRunning.value = false;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    return;
  }

  // 对每个关节进行 lerp 插值
  const newJointValues = currentJointValues.value.map((current, i) => {
    const target = targetJointValues.value[i];
    return current + (target - current) * lerpFactor; // lerp 公式
  });

  // 更新机械臂关节（通过父组件）
  emit("joint-change", {
    jointValues: newJointValues,
  });

  // 更新当前值
  currentJointValues.value = newJointValues;

  // 检查是否足够接近目标，可设置一个阈值，比如 0.01
  const isClose = targetJointValues.value.every(
    (t, i) => Math.abs(t - newJointValues[i]) < 0.01
  );

  if (isClose) {
    // 接近目标，切换到下一帧
    currentFrameIndex.value++;
  }

  // 请求下一帧动画
  animationFrameId = requestAnimationFrame(smoothDemoLoop);
};

// 精细微调关节（± 按钮）
const stepJoint = (index, step) => {
  const targetValues = jointValues.value.slice();

  let val = targetValues[index] + step;
  val = Math.max(joints.value[index].min, Math.min(joints.value[index].max, val));

  targetValues[index] = val;

  if (props.robotConnected) {
    // 已连接：只发命令，等机器人反馈更新页面
    sendMoveToRobot(targetValues);
    return;
  }

  // 未连接：本地仿真，立即更新页面
  jointValues.value = targetValues;

  emit("joint-change", {
    jointValues: targetValues.map(Number),
    fromFeedback: true,
  });
};

//开始演示 - 逐步改变关节值到目标位置
const startDemo = (jointArr) => {
  if (isDemoRunning.value) return;

  const targetPositions = jointArr;

  // 检查是否已经在目标位置
  const isAtTarget = jointValues.value.every(
    (current, index) => Math.abs(current - targetPositions[index]) < 0.01
  );

  if (isAtTarget) {
    console.log("已经在目标位置，无需移动");
    return;
  }

  isDemoRunning.value = true;
  currentFrameIndex.value = 0;

  // 使用插值动画逐步移动到目标位置
  smoothDemoLoopToTarget(targetPositions);
};

//平滑插值到目标位置
const smoothDemoLoopToTarget = async (targetPositions) => {
  // 插值参数
  const lerpFactor = 0.05; // 调整这个值可以改变动画速度
  const stepSize = 0.1; // 步长

  const animate = () => {
    if (!isDemoRunning.value) return;

    let allReached = true;

    // 对每个关节进行插值
    const newJointValues = jointValues.value.map((current, index) => {
      const target = targetPositions[index];
      const difference = target - current;

      // 如果差距很小，直接设为目标值
      if (Math.abs(difference) < stepSize) {
        return target;
      }

      allReached = false;

      // 按步长递增/递减
      if (difference > 0) {
        return Math.min(current + stepSize, target);
      } else {
        return Math.max(current - stepSize, target);
      }
    });

    // 更新当前关节值
    jointValues.value = newJointValues;

    // 发送更新到父组件
    emit("joint-change", {
      jointValues: newJointValues.map(Number),
    });

    //  演示动画也自动发送官方指令
    sendMoveToRobot(newJointValues);

    if (allReached) {
      // 到达目标位置
      console.log("✅ 已到达目标位置");
      isDemoRunning.value = false;
    } else {
      // 继续动画
      requestAnimationFrame(animate);
    }
  };

  // 开始动画
  animate();
};

//临时增加手势控制连接
//手势连接
const handleConnectGesture = async (gesture) => {
  await window.electronAPI.connectGesture("192.168.6.123", 5000);
  window.electronAPI.onGestureData((data) => {
    console.log("收到手势：", data);

    // 解析后直接控制机械臂
    // jointValues.value[0] = ...
    // sendMoveToRobot(jointValues.value)
  });
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

  // 连接手势 临时增加
  handleConnectGesture();
});

onUnmounted(() => {
  // 断开手势 临时增加
  handleDisconnectGesture();
});
</script>

<style scoped>
.control-panel {
  background: rgba(245, 245, 245, 0.95);
  height: 100%;
  overflow-y: auto;
  position: relative;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(5px);
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

/* 滑动条样式 */
.slider-container input[type="range"] {
  width: 100%;
  margin: 5px 0;
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

/* 重置按钮悬停效果  */
.reset-all-btn:hover {
  background-color: #c0392b;
}
</style>