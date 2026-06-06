<template>
  <div class="robot-model-container">
    <!-- 用于承载 Three.js 渲染画布的容器 -->
    <div ref="container" class="canvas-container"></div>

    <!-- 控制面板组合：机械臂控制 + 轨迹记录控制 -->
    <div class="control-panels">
      <!-- 机械臂控制面板 -->
      <RobotControlBlockly @joint-change="handleJointChange" @gripper-change="handleGripperChange"
        @reset-all="resetAllJoints" :jointArr="jointArr" :robotConnected="robotConnected" />


      <!-- 轨迹记录控制面板 -->
      <div class="trajectory-controls">
        <div class="controls-title">轨迹控制</div>
        <div style="display:flex;gap:6px;align-items:center;"><button @click="toggleRecord" :disabled="isPlaying"
            :class="{ active: isRecording }">
            {{ isRecording ? "停止记录" : "开始记录" }}
          </button>
          <button @click="playRecord" :disabled="!hasRecord || isRecording || isPlaying">
            回放轨迹
          </button>
          <button @click="clearRecord" :disabled="!hasRecord || isRecording || isPlaying">
            清除记录
          </button>
        </div>
        <div class="info">
          末端坐标: X: {{ endX.toFixed(2) }}, Y: {{ endY.toFixed(2) }}, Z:
          {{ endZ.toFixed(2) }}<br />
          状态: {{ statusText }}
        </div>
      </div>

      <!-- Mesh 信息显示面板 -->
      <div class="mesh-info-panel">
        <div class="controls-title">🔧 当前选中部件</div>
        <div v-if="selectedMeshInfo.name">
          <p><strong>名称:</strong> {{ selectedMeshInfo.name }}</p>
          <p><strong>id:</strong> {{ selectedMeshInfo.id }}</p>
          <p>
            <strong>世界坐标:</strong> X: {{ selectedMeshInfo.x.toFixed(2) }}, Y:
            {{ selectedMeshInfo.y.toFixed(2) }}, Z:
            {{ selectedMeshInfo.z.toFixed(2) }}
          </p>
          <p><strong>状态:</strong> 已选中（点击相同部位取消）</p>
        </div>
        <div v-else>
          <p style="font-style: italic; color: #aaa">未选中任何部件</p>
        </div>
      </div>


      <!-- 机器人链接面板  -->
      <div class="mesh-info-panel">
        <div class="controls-title">机器人链接</div>
        <div style="display:flex;gap:6px;align-items:center;margin:8px 0;">
          <input v-model.number="ipArr[0]" type="number" min="0" max="255"
            style="width:55px;padding:4px;text-align:center" />
          <span>.</span>
          <input v-model.number="ipArr[1]" type="number" min="0" max="255"
            style="width:55px;padding:4px;text-align:center" />
          <span>.</span>
          <input v-model.number="ipArr[2]" type="number" min="0" max="255"
            style="width:55px;padding:4px;text-align:center" />
          <span>.</span>
          <input v-model.number="ipArr[3]" type="number" min="0" max="255"
            style="width:55px;padding:4px;text-align:center" />
        </div>
        <div style="margin:6px 0;">端口：<input v-model.number="robotPort" type="number" style="width:80px;padding:4px"
            placeholder="端口" /></div>

        <!-- 扫描功能 新增 -->
        <div style="margin:6px 0;">
          <button @click="scanRobots" :disabled="isScanning">
            {{ isScanning ? '扫描中...' : '扫描局域网机器人' }}
          </button>
        </div>

        <!-- 扫描结果列表 -->
        <div v-if="scanResult.length > 0" style="margin:8px 0; max-height:100px;overflow-y:auto;">
          <div style="font-size:12px; margin-bottom:4px;">扫描到机器人：</div>
          <div v-for="ip in scanResult" :key="ip" @click="selectScanIp(ip)"
            style="font-size:12px; padding:3px 6px; background:#333; margin:2px 0; border-radius:3px; cursor:pointer;">
            {{ ip }}
          </div>
        </div>

        <div style="margin-top:8px; display:flex; flex-wrap:wrap; gap:6px;">
          <button @click="connectRobot">连接机器人</button>
          <button @click="disconnectRobot">断开</button>
          <!--在线模式锁定按钮-->
          <!-- <button @click="setTcpMode" style="background:#ff9500;">锁定Tcp模式</button> -->
          <button @click="enableRobot" style="background:#00b42a;">上使能</button>
          <button @click="disableRobot" style="background:#ff4d4f;">下使能</button>
          <button @click="clearErrRobot" style="background:#ffa500;">清除故障</button>
          <!-- 进入关节拖拽模式 -->
          <button @click="startDragGesture" style="background:#00b42a;">进入拖拽</button>
          <!-- 退出拖拽模式 -->
          <button @click="stopDragGesture" style="background:#ff4d4f;">退出拖拽</button>
        </div>
        <div style="margin-top:6px;font-size:12px;color:#ccc;">连接状态：{{ robotStatus }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, reactive, computed, watch } from "vue";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

import { TransformControls } from "three/examples/jsm/controls/TransformControls";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer";
import URDFLoader from "urdf-loader";
import RobotControlBlockly from "@/components/RobotControlBlockly.vue"; // 确保该组件路径正确
const props = defineProps({
  codeArr: {
    type: Array,
    default: () => [],
  },
});

const robotConnected = ref(false);

// ===== 扫描机器人相关 =====
const isScanning = ref(false);
const scanResult = ref([]); // 扫描到的IP列表

// ===== 机器人TCP连接变量 =====
const ipArr = ref([192, 168, 6, 200]); // 默认IP：192.168.6.200
const robotPort = ref(29999); // 越疆默认端口可自行修改

const robotStatus = ref("未连接");

let offRobotFeedback = null;// 关闭机器人反馈监听

// 拼接完整IP字符串
const getFullIp = () => ipArr.value.join(".");
// 扫描局域网机器人
const scanRobots = async () => {
  if (!window.electronAPI) {
    alert("仅Electron环境可用");
    return;
  }

  isScanning.value = true;
  scanResult.value = [];

  // 调用主进程扫描
  const res = await window.electronAPI.scanRobots(robotPort.value);
  console.log("扫描结果:", res);
  scanResult.value = res || [];
  isScanning.value = false;
};

// 点击扫描结果，自动填入IP
const selectScanIp = (ip) => {
  const arr = ip.split(".");
  ipArr.value = arr.map(Number);
};



// 切换TCP模式
// const setTcpMode = async () => {
//   if (!window.electronAPI) return;
//   await window.electronAPI.setTcpMode();
//   console.log("✅ 已切换为TCP远程模式");
// };
// 连接机器人
const connectRobot = async () => {
  if (!window.electronAPI) {
    alert("仅Electron环境可用");
    return;
  }
  const ip = getFullIp();
  const port = robotPort.value;
  robotStatus.value = "正在连接...";

  const res = await window.electronAPI.connectRobot(ip, port);

  if (res) {
    robotConnected.value = true;
    robotStatus.value = `已连接 ${ip}:${port}`;

    //  官方标准顺序：TCP模式 → 清报警 → 上使能
    await window.electronAPI.setTcpMode();
    console.log(" 已切换：TCP远程模式");

    await new Promise(r => setTimeout(r, 300));

    await window.electronAPI.clearErrorRobot();
    console.log(" 已清除报警");

    await new Promise(r => setTimeout(r, 300));

    // 这里可以自动使能，也可以手动点
    // await window.electronAPI.enableRobot();
  } else {
    robotStatus.value = "连接失败";
  }
};

// 断开机器人
const disconnectRobot = async () => {
  if (!window.electronAPI) return;
  await window.electronAPI.disconnectRobot();
  robotStatus.value = "已断开";
  robotConnected.value = false;
};

// 上使能
const enableRobot = async () => {
  if (!window.electronAPI) return;
  await window.electronAPI.enableRobot();
  console.log("✅ 已发送：上使能");
};

// 下使能
const disableRobot = async () => {
  if (!window.electronAPI) return;
  await window.electronAPI.disableRobot();
  console.log("已发送：下使能");
};
// 清除故障
const clearErrRobot = async () => {
  await window.electronAPI.clearErrorRobot();
};

// 进入关节拖拽模式
const startDragGesture = async () => {
  console.log('进入拖拽');
  await window.electronAPI.startDragRobot();
};
// 退出拖拽模式
const stopDragGesture = async () => {
  await window.electronAPI.stopDragRobot();
};



const jointArr = ref([]);
// const translateJoint = (codeArr) => {
//   console.log("接受的codeArr", codeArr);
//   // 角度转换rad
//   if (!Array.isArray(codeArr) || codeArr.length !== 6) {
//     console.error("请输入包含6个角度值的数组");
//     return null;
//   }

//   // 角度转弧度：弧度 = 角度 × (π / 180)
//   const radianArr = codeArr.map((angle) => {
//     // 确保输入是数字
//     const numAngle = parseFloat(angle);
//     if (isNaN(numAngle)) {
//       console.error("角度值必须是数字");
//       return 0;
//     }
//     // 转换为弧度
//     return numAngle * (Math.PI / 180);
//   });
//   // console.log("角度数组:", codeArr);
//   console.log("弧度数组:", radianArr);

//   jointArr.value = radianArr.map((rad, index) => {
//     return rad.toFixed(3);
//   });

//   console.log("弧度数组转换后的角度数组:", jointArr.value);
//   return radianArr;
// };

const translateJoint = (codeArr) => {
  console.log("接受的codeArr", codeArr);

  // 1. 宽松校验：允许数组长度不足6，不足补0，多余截断（应对网络波动）
  if (!Array.isArray(codeArr)) {
    console.error("请输入数组类型的角度数据");
    jointArr.value = [0, 0, 0, 0, 0, 0]; // 重置为默认有效数字数组
    return [0, 0, 0, 0, 0, 0];
  }

  // 处理数组长度：不足6补0，超过6截断（ 6个元素）
  const validCodeArr = [...codeArr].slice(0, 6);
  while (validCodeArr.length < 6) {
    validCodeArr.push(0);
  }

  // 2. 角度转弧度 严格过滤无效值（ 范围改为 ±360°）
  const radianArr = validCodeArr.map((angle) => {
    // 确保输入是数字
    const numAngle = parseFloat(angle);
    if (isNaN(numAngle)) {
      console.error("角度值必须是数字，当前值：", angle);
      return 0;
    }

    // 关键修改：过滤超出 ±360° 的无效角度（支持正负360°范围）
    let validAngle = numAngle;
    if (validAngle < -360) validAngle = -360; // 最小值限制为 -360°
    if (validAngle > 360) validAngle = 360; // 最大值限制为 360°
    if (numAngle !== validAngle) {
      console.warn(`角度 ${numAngle}° 超出范围（±360°），已修正为 ${validAngle}°`);
    }

    // 转换为弧度（±360° 对应 ±6.28 弧度，符合机械臂要求）
    return validAngle * (Math.PI / 180);
  });

  console.log("有效角度数组（-360~360°）:", validCodeArr);
  console.log("转换后的弧度数组（±6.28）:", radianArr);

  // 3. 直接赋值数字数组（ 保留原始数字类型）
  jointArr.value = radianArr; // 纯数字数组，子组件可直接使用
  console.log("最终传递给子组件的弧度数组:", jointArr.value);

  return radianArr;
};
watch(
  () => props.codeArr,
  (newVal) => {
    translateJoint(newVal);
  },
  { deep: true, immediate: true }
);

// 鼠标点击相关
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedMesh = null; // 当前选中的 Mesh，可用于取消高亮等、
let robotGroup = null;

const trackedMeshForTrajectory = ref(null);

let virtualJointGroup = null; // 初始为 null

// 当前选中的 Mesh 信息，用于在页面显示
const selectedMeshInfo = reactive({
  id: null,
  name: "", // Mesh 名称
  x: 0, // 世界坐标 X
  y: 0, // 世界坐标 Y
  z: 0, // 世界坐标 Z
});

//记录关节

// 容器引用
const container = ref(null);

// 轨迹记录相关状态
const state = reactive({
  isRecording: false,
  isPlaying: false,
  trajectory: [],
  tempTrajectory: [],
  endX: 0,
  endY: 0,
  endZ: 0,
  lastRecordedPoint: null,
  jointTrajectory: [], // 正式记录的关节角度轨迹
  tempJointTrajectory: [], // 临时记录中的关节角度轨迹
});

// 计算属性
const isRecording = computed(() => state.isRecording);
const isPlaying = computed(() => state.isPlaying);
const hasRecord = computed(() => state.trajectory.length > 0);
const endX = computed(() => state.endX);
const endY = computed(() => state.endY);
const endZ = computed(() => state.endZ);

const statusText = computed(() => {
  if (state.isRecording) return `正在记录（${state.tempTrajectory.length}个点）`;
  if (state.isPlaying) return `正在回放（${Math.round(playProgress.value * 100)}%）`;
  if (hasRecord.value) return `已记录轨迹（${state.trajectory.length}个点）`;
  return "就绪（可开始记录轨迹）";
});

// 回放进度
const playProgress = ref(0);

// Three.js 核心对象
let scene, camera, renderer, labelRenderer, controls;
let robot, endEffector, transformControls;
let trajectoryLine, tempTrajectoryLine, originSphere;
let playInterval = null;
let lastEmitTime = 0;

// 坐标转换工具函数（统一坐标系：X右、Y前、Z上）
const targetToThree = (targetX, targetY, targetZ) => {
  return new THREE.Vector3(
    targetX, // X轴: 直接映射（右正）
    targetZ, // Z轴: 目标Z(上) → Three.js Y(上)
    targetY // Y轴: 目标Y(前) → Three.js Z(向内，取负)
  );
};

/**
 * 更新虚拟骨骼（关节球体和连接线条）
 */

const threeToTarget = (threeVec3) => {
  return {
    x: threeVec3.x,
    y: threeVec3.z,
    z: threeVec3.y,
  };
};


const initScene = () => {
  // 创建场景
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xeeeeee);

  // 创建相机（保留原有参数，兼容双架构）
  camera = new THREE.PerspectiveCamera(
    85,
    container.value.clientWidth / container.value.clientHeight,
    0.01,
    1000
  );

  // ========== 跨架构兼容：渲染器配置拆分 ==========
  // 基础配置（双架构通用）
  const baseRendererOptions = {
    antialias: true,
    powerPreference: "high-performance",
    shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap },
    physicallyCorrectLights: true,
    outputColorSpace: THREE.SRGBColorSpace,
  };

  // ARM64 专属配置（仅在 ARM 架构下启用）
  let rendererOptions = { ...baseRendererOptions };
  const isARM64 =
    /arm64|aarch64/.test(navigator.userAgent.toLowerCase()) ||
    /Linux arm64/.test(navigator.platform);
  if (isARM64) {
    rendererOptions = {
      ...rendererOptions,
      logarithmicDepthBuffer: false,
      preserveDrawingBuffer: false,
      stencilBuffer: false,
      preserveWebGLContext: true, // 仅 ARM64 启用
      failIfMajorPerformanceCaveat: true,
    };
  } else {
    // Windows 专属配置（恢复正常渲染）
    rendererOptions.logarithmicDepthBuffer = true;
    rendererOptions.preserveWebGLContext = false;
  }

  // 统一创建渲染器（不再强制复用 GL 上下文，避免 Windows 冲突）
  renderer = new THREE.WebGLRenderer(rendererOptions);
  // ==============================================

  // 渲染器基础配置（双架构通用）
  renderer.setSize(container.value.clientWidth, container.value.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.value.appendChild(renderer.domElement);

  // 标签渲染器（双架构通用，确保初始化）
  labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(container.value.clientWidth, container.value.clientHeight);
  labelRenderer.domElement.style.position = "absolute";
  labelRenderer.domElement.style.top = "0";
  labelRenderer.domElement.style.pointerEvents = "none";
  container.value.appendChild(labelRenderer.domElement);

  // 光源配置（保留原有，双架构通用）
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
  directionalLight.position.set(10, 20, 10);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.set(2048, 2048);
  scene.add(directionalLight);

  const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.9);
  directionalLight2.position.set(-8, 15, -8);
  scene.add(directionalLight2);

  const ambientLight = new THREE.AmbientLight(0x606060, 1.3);
  scene.add(ambientLight);

  // 网格地面（保留）
  const gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x888888);
  gridHelper.position.y = -0.01;
  scene.add(gridHelper);

  // 添加带标签的坐标轴（保留）
  addAxesWithLabels();

  // 轨道控制器（保留，双架构通用）
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  // 加载机器人模型（保留）
  loadRobotModel();

  // ========== 启动渲染循环 ==========
  animate();
};

/**
 * 添加带标签的坐标轴
 */
const addAxesWithLabels = () => {
  const axisLength = 5;

  // X轴（红）
  scene.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        targetToThree(0, 0, 0),
        targetToThree(axisLength, 0, 0),
      ]),
      new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 })
    )
  );

  // Y轴（绿）
  scene.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        targetToThree(0, 0, 0),
        targetToThree(0, axisLength, 0),
      ]),
      new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 })
    )
  );

  // Z轴（蓝）
  scene.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        targetToThree(0, 0, 0),
        targetToThree(0, 0, axisLength),
      ]),
      new THREE.LineBasicMaterial({ color: 0x0000ff, linewidth: 2 })
    )
  );

  // 坐标轴标签
  const createAxisLabel = (text, color, targetPos) => {
    const div = document.createElement("div");
    div.textContent = text;
    div.style = `color: ${color}; font-family: Arial; font-size: 14px; font-weight: bold; background: rgba(	211,211,211,0.7); padding: 2px 6px; border-radius: 3px;`;
    const label = new CSS2DObject(div);
    label.position.copy(targetToThree(targetPos.x, targetPos.y, targetPos.z));
    scene.add(label);
  };

  createAxisLabel("X", "#ff0000", { x: axisLength + 0.3, y: 0, z: 0 });
  createAxisLabel("Y", "#00ff00", { x: 0, y: axisLength + 0.3, z: 0 });
  createAxisLabel("Z", "#0000ff", { x: 0, y: 0, z: axisLength + 0.3 });
};

//  记录关键 Mesh（trackedMesh）的轨迹点
const recordTrackedMeshTrajectory = () => {
  if (!trackedMeshForTrajectory.value) {
    console.warn("trackedMeshForTrajectory 未找到，请检查模型是否包含 name 为空的 Mesh");
    return;
  }

  // 获取世界坐标
  const worldPos = trackedMeshForTrajectory.value.getWorldPosition(new THREE.Vector3());
  const targetPos = threeToTarget(worldPos);

  const currentPoint = {
    x: targetPos.x,
    y: targetPos.y,
    z: targetPos.z,
  };

  // 去重（避免连续帧太近导致轨迹点过多）
  const isSameAsLast =
    state.lastRecordedPoint &&
    Math.abs(currentPoint.x - state.lastRecordedPoint.x) < 0.01 &&
    Math.abs(currentPoint.y - state.lastRecordedPoint.y) < 0.01 &&
    Math.abs(currentPoint.z - state.lastRecordedPoint.z) < 0.01;

  if (!isSameAsLast) {
    state.tempTrajectory.push(currentPoint);
    state.lastRecordedPoint = currentPoint;
    updateTempTrajectoryLine(); // 实时画出轨迹线（黄色）
  }
};


const loadRobotModel = () => {
  console.log("加载机器人模型...");
  // 1. 配置GLTF+DRACO加载器（开启GPU加速解码，保留该优化）
  const gltfLoader = new GLTFLoader();
  console.log(gltfLoader);
  try {
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(
      "https://cdn.jsdelivr.net/npm/three@0.150.1/examples/jsm/libs/draco/"
    );
    dracoLoader.setDecoderConfig({ type: "webgl" }); // 强制使用WebGL GPU解码（保留，不影响模型结构）
    gltfLoader.setDRACOLoader(dracoLoader);

    console.log(111);
  } catch (e) {
    console.warn("DRACO加载失败:", e);
  }

  // ========== 原有路径适配逻辑  ==========
  let kr1Path = "/kr1"; // 开发环境（public 根路径）
  if (window.electronAPI && !import.meta.env.DEV) {
    // 打包后的 Electron 环境：使用 resources 目录下的 kr1
    kr1Path = window.electronAPI.getResourcesPath() + "/kr1";
  }

  const loader = new URDFLoader();
  loader.packages = { kr1: kr1Path }; //使用适配后的路径

  // 2. 修复路径解析 
  loader.loadMeshCb = (path, manager, onComplete) => {
    // 先处理原始路径（去掉开头的"./"，确保路径格式统一）
    let glbPath = path.replace(/^\.+/, "");
    glbPath = glbPath.startsWith("/") ? glbPath : `/${glbPath}`;

    // 适配打包环境路径 
    if (window.electronAPI && !import.meta.env.DEV) {
      glbPath = glbPath.replace(/^\/kr1\//, `${kr1Path}/`);
    }

    console.log("实际加载路径:", glbPath); // 验证路径是否正确

    // 加载GLB模型
    gltfLoader.load(
      glbPath,
      (gltf) => {
        const model = gltf.scene;

        // 校验模型顶点是否有 NaN 
        model.traverse((child) => {
          if (child.isMesh) {
            const positionAttr = child.geometry.attributes.position;
            if (positionAttr) {
              const positions = positionAttr.array;
              for (let i = 0; i < positions.length; i++) {
                if (isNaN(positions[i])) {
                  console.error(`模型 ${child.name} 存在 NaN 顶点，替换为 0`);
                  positions[i] = 0; // 修复 NaN 顶点（保留）
                }
              }
              child.geometry.attributes.position.needsUpdate = true;
              child.geometry.computeBoundingSphere(); // 重新计算包围球（保留）


              // ========== 安全的GPU优化  ==========
              child.geometry.computeVertexNormals();
              // ==============================================
            }

            // ========== 安全的材质GPU优化（ ==========
            if (child.material) {
              child.material.side = THREE.FrontSide; // 只渲染正面， 
              child.material.needsUpdate = true;
              child.material.precision = "highp"; // 高精度材质， 
            }
            // ==============================================

            // 开启视锥体裁剪 
            child.frustumCulled = true;
          }
        });

        model.scale.set(0.001, 0.001, 0.001); // 毫米转米（保留原有缩放）
        onComplete(model);
      },
      undefined,
      (error) => {
        console.error(`加载GLB失败（${glbPath}）:`, error);
        const placeholder = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 0.1, 0.1),
          new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true })
        );
        onComplete(placeholder);
      }
    );
  };

  // 3. 原有关节初始位置逻辑（保留不变）
  const INITIAL_POSITIONS = {
    joint1: 0.0, // 底座关节给一个小角度
    joint2: 0.0, // 上臂抬起
    joint3: 0.0, // 前臂再抬起
    joint4: 0.0,
    joint5: 0.0,
    joint6: 0.0,
  };

  // 适配URDF文件路径（保留不变）
  let urdfPath = "./kr1/urdf/kr1.urdf"; // 开发环境
  if (window.electronAPI && !import.meta.env.DEV) {
    urdfPath = `${window.electronAPI.getResourcesPath()}/kr1/urdf/kr1.urdf`;
  }

  loader.load(urdfPath, (result) => {
    // 使用适配后的urdf路径
    robot = result;
    console.log(robot);

    robot.scale.set(2, 2, 2);
    robot.rotation.x = -Math.PI / 2;
    robot.position.set(0, 0, 0);

    robotGroup = new THREE.Group();
    scene.add(robotGroup);
    robotGroup.add(robot);

    console.log("robot:", robot);
    console.log("robotGroup:", robotGroup);

    let trackedMesh = robot.getObjectByName("Link6");
    console.log(trackedMesh);

    if (trackedMesh) {
      endEffector = trackedMesh;
      trackedMeshForTrajectory.value = trackedMesh;

      // 先设置初始关节位置（保留不变）
      Object.entries(INITIAL_POSITIONS).forEach(([jointName, value]) => {
        if (robot.joints[jointName]) {
          robot.joints[jointName].setJointValue(value);
        }
      });

      // 更新矩阵世界（保留不变）
      robot.updateMatrixWorld(true);
      robotGroup.updateMatrixWorld(true);

      // 获取末端执行器位置（保留不变）
      const worldPos = new THREE.Vector3();
      trackedMesh.getWorldPosition(worldPos);
      const targetPos = threeToTarget(worldPos);

      state.endX = targetPos.x;
      state.endY = targetPos.y;
      state.endZ = targetPos.z;

      console.log(
        "✅ 初始末端世界坐标：X:",
        state.endX.toFixed(2),
        "Y:",
        state.endY.toFixed(2),
        "Z:",
        state.endZ.toFixed(2)
      );
    } else {
      console.warn("未找到 name 为空的末端 Mesh，请检查模型加载结构！");
    }

    // 设置相机视角（保留不变）
    const box = new THREE.Box3().setFromObject(robot);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();

    camera.position.set(center.x + 2, center.y + 2, center.z + 7);
    camera.lookAt(center);
    controls.update();

    animate();
  });
};

// 设置鼠标点击事件
const setupMouseClick = () => {
  const canvas = renderer.domElement;

  canvas.addEventListener("click", onMouseClick, false);

  function onMouseClick(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster
      .intersectObjects(robotGroup.children, true)
      .filter((intersect) => intersect.object instanceof THREE.Mesh);

    if (intersects.length > 0) {
      const intersect = intersects[0];
      const mesh = intersect.object;

      if (mesh instanceof THREE.Mesh) {
        console.log("  被点击的 Mesh:", {
          name: mesh.name,
          parent: mesh.parent ? mesh.parent.name : "无父级",
          object3d: mesh,
        });

        if (selectedMesh === mesh) {
          console.log(11111);
          // 点击相同 Mesh → 取消选中
          if (mesh.material && mesh.userData.originalColor) {
            mesh.material.color.copy(mesh.userData.originalColor);
          } else if (mesh.material) {
            mesh.material.color.set(0xcccccc);
          }
          if (mesh.material) {
            mesh.material.emissive.setHex(0x000000);
          }

          selectedMesh = null;
          selectedMeshInfo.name = "";
          selectedMeshInfo.id = null;
          selectedMeshInfo.x = 0;
          selectedMeshInfo.y = 0;
          selectedMeshInfo.z = 0;
        } else {
          // 点击新 Mesh → 高亮
          if (selectedMesh) {
            console.log(222222);
            // 清除之前选中的
            if (selectedMesh.material && selectedMesh.userData.originalColor) {
              selectedMesh.material.color.copy(selectedMesh.userData.originalColor);
            } else if (selectedMesh.material) {
              selectedMesh.material.color.set(0xcccccc);
            }
            if (selectedMesh.material) {
              selectedMesh.material.emissive.setHex(0x000000);
            }
            selectedMesh = null;
          }

          if (!mesh.userData.originalColor && mesh.material) {
            mesh.userData.originalColor = mesh.material.color.clone();
          }

          if (mesh.material) {
            mesh.material.color.set(0xff0000);
            mesh.material.emissive.setHex(0x444444);
          }

          selectedMesh = mesh;
          console.log(mesh);
          const worldPos = mesh.getWorldPosition(new THREE.Vector3());

          // console.log(mesh.getWorldPosition(worldPos));
          const targetPos = threeToTarget(worldPos);

          selectedMeshInfo.name = mesh.name || "Unnamed";
          selectedMeshInfo.id = mesh.id;
          selectedMeshInfo.x = targetPos.x;
          selectedMeshInfo.y = targetPos.y;
          selectedMeshInfo.z = targetPos.z;
        }
      }
    } else {
      // 点击空白处 → 清除选中
      if (selectedMesh) {
        if (selectedMesh.material && selectedMesh.userData.originalColor) {
          selectedMesh.material.color.copy(selectedMesh.userData.originalColor);
        } else if (selectedMesh.material) {
          selectedMesh.material.color.set(0xcccccc);
        }
        if (selectedMesh.material) {
          selectedMesh.material.emissive.setHex(0x000000);
        }

        selectedMesh = null;
        selectedMeshInfo.name = "";
        selectedMeshInfo.id = null;
        selectedMeshInfo.x = 0;
        selectedMeshInfo.y = 0;
        selectedMeshInfo.z = 0;
      }
    }
  }
};
/**
 * 更新临时轨迹线
 */
const updateTempTrajectoryLine = () => {
  if (tempTrajectoryLine) {
    scene.remove(tempTrajectoryLine);
    tempTrajectoryLine.geometry.dispose();
  }

  if (state.tempTrajectory.length > 1) {
    const points = state.tempTrajectory.map((p) => targetToThree(p.x, p.y, p.z));
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: 0xffff00, linewidth: 2 });
    tempTrajectoryLine = new THREE.Line(geo, mat);
    scene.add(tempTrajectoryLine);
  }
};

/**
 * 动画循环
 */
const animate = () => {
  requestAnimationFrame(animate);
  controls.update(); // 轨道控制器更新（必须保留）

  // 双架构通用渲染逻辑（核心！之前可能因为条件判断导致渲染不执行）
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
    // 确保 labelRenderer 存在再渲染
    if (labelRenderer) {
      labelRenderer.render(scene, camera);
    }
  }

  // ARM64 专属：强制 GPU 刷新（仅 ARM 下执行）
  const isARM64 = /arm64|aarch64/.test(navigator.userAgent.toLowerCase());
  if (isARM64 && renderer) {
    renderer.getContext().flush();
    if (renderer.info?.render?.frame % 10 === 0) {
      renderer.clearDepth();
    }
  }
};

/**
 * 窗口大小调整
 */
const handleResize = () => {
  const width = container.value.clientWidth;
  const height = container.value.clientHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  labelRenderer.setSize(width, height);
};

/**
 * 机械臂关节控制
 */
const handleJointChange = ({ jointValues, fromFeedback }) => {
  if (!fromFeedback) return;
  if (!robot) return;

  const jointOrder = ["joint1", "joint2", "joint3", "joint4", "joint5", "joint6"];

  jointValues.forEach((value, index) => {
    const jointName = jointOrder[index];
    // 最终校验：确保 value 是有效数字，否则设为 0
    const validValue = isNaN(parseFloat(value)) ? 0 : parseFloat(value);
    if (robot.joints[jointName]) {
      robot.joints[jointName].setJointValue(validValue);
    }
  });

  // 强制更新矩阵世界（避免模型顶点计算异常）
  robot.updateMatrixWorld(true);
  if (robotGroup) {
    robotGroup.updateMatrixWorld(true);
  }

  // 记录轨迹（仅在有效数据时）
  state.tempJointTrajectory.push([...jointValues]);
  recordTrackedMeshTrajectory();
};
/**
 * 夹爪控制
 */
const handleGripperChange = (value) => {
  if (robot && robot.joints.finger_joint) {
    robot.joints.finger_joint.setJointValue(value);
  }
};

/**
 * 重置关节
 */
const resetAllJoints = (positions) => {
  if (!robot) return;

  // 🔧 先设置关节角度
  Object.entries(positions).forEach(([jointName, value]) => {
    if (robot.joints[jointName]) {
      robot.joints[jointName].setJointValue(value);
    }
  });

  // 🔧 更新矩阵世界
  robot.updateMatrixWorld(true);
  if (robotGroup) {
    robotGroup.updateMatrixWorld(true);
  }

  // 🔧 然后更新末端坐标
  if (endEffector) {
    // 确保末端执行器的矩阵也是最新的
    endEffector.updateMatrixWorld(true);

    const worldPos = new THREE.Vector3();
    endEffector.getWorldPosition(worldPos);
    const targetPos = threeToTarget(worldPos);

    state.endX = targetPos.x;
    state.endY = targetPos.y;
    state.endZ = targetPos.z;

    clearRecord();

    console.log(
      "🔄 复位后末端坐标：X:",
      state.endX.toFixed(2),
      "Y:",
      state.endY.toFixed(2),
      "Z:",
      state.endZ.toFixed(2)
    );
  }
};

// 专门更新末端执行器位置的函数
const updateEndEffectorPosition = () => {
  if (!endEffector) {
    console.warn("endEffector 未定义，无法更新坐标");
    return;
  }

  // 多次尝试获取坐标，确保模型更新完成
  const maxRetries = 5;
  let retryCount = 0;

  const tryUpdatePosition = () => {
    // 确保末端执行器的矩阵是最新的
    endEffector.updateMatrixWorld(true);

    // 获取世界坐标
    const worldPos = new THREE.Vector3();
    endEffector.getWorldPosition(worldPos);

    const targetPos = threeToTarget(worldPos);

    console.log(`尝试 ${retryCount + 1}: 末端坐标:`, targetPos);

    // 检查坐标是否合理（不是全零）
    if (
      Math.abs(targetPos.x) > 0.001 ||
      Math.abs(targetPos.y) > 0.001 ||
      Math.abs(targetPos.z) > 0.001
    ) {
      state.endX = targetPos.x;
      state.endY = targetPos.y;
      state.endZ = targetPos.z;
      console.log(
        "✅ 末端坐标更新成功:",
        state.endX.toFixed(2),
        state.endY.toFixed(2),
        state.endZ.toFixed(2)
      );
    } else if (retryCount < maxRetries) {
      retryCount++;
      // 延迟重试
      setTimeout(tryUpdatePosition, 50);
    } else {
      console.error("❌ 无法获取有效的末端坐标，使用默认值");
      // 设置一个合理的默认坐标
      state.endX = 0;
      state.endY = 0.5; // 假设机械臂有一定高度
      state.endZ = 0.5;
    }
  };

  tryUpdatePosition();
};

/**
 * 轨迹记录控制
 */
const toggleRecord = () => {
  if (state.isRecording) {
    state.isRecording = false;
    state.jointTrajectory = [...state.tempJointTrajectory]; // 保存正式关节轨迹
    state.trajectory = [...state.tempTrajectory]; // 如果你仍想记录末端点，也可以存
  } else {
    state.tempTrajectory = [];
    state.tempJointTrajectory = []; // 清空临时关节轨迹
    state.lastRecordedPoint = null;
    state.isRecording = true;
    updateTempTrajectoryLine();
  }
};

/**
 * 轨迹回放
 */
const playRecord = () => {
  if (state.jointTrajectory.length < 2) return; // 确保有数据

  state.isPlaying = true;
  // transformControls.enabled = false;
  let index = 0;
  const totalFrames = state.jointTrajectory.length;

  playInterval = setInterval(() => {
    if (index >= totalFrames) {
      clearInterval(playInterval);
      state.isPlaying = false;
      // transformControls.enabled = true;
      playProgress.value = 0;
      return;
    }

    // 当前帧的关节角度数组
    const jointValues = state.jointTrajectory[index];

    const jointOrder = ["joint1", "joint2", "joint3", "joint4", "joint5", "joint6"];

    jointValues.forEach((value, i) => {
      const jointName = jointOrder[i];
      if (robot.joints[jointName]) {
        robot.joints[jointName].setJointValue(value);
      }
    });

    console.log("🔧 回放中，endEffector:", endEffector);

    // 可选：更新末端显示坐标
    if (endEffector) {
      const targetPos = threeToTarget(endEffector.position);
      state.endX = targetPos.x;
      state.endY = targetPos.y;
      state.endZ = targetPos.z;
    }

    playProgress.value = index / totalFrames;
    index++;
  }, 50); // 每50ms一帧，可调整
};

/**
 * 清除轨迹
 */
const clearRecord = () => {
  state.trajectory = [];
  state.tempTrajectory = [];
  state.lastRecordedPoint = null;

  if (trajectoryLine) {
    scene.remove(trajectoryLine);
    trajectoryLine = null;
  }
  if (tempTrajectoryLine) {
    scene.remove(tempTrajectoryLine);
    tempTrajectoryLine = null;
  }
};

// 生命周期
onMounted(() => {
  // ========== 跨架构兼容：仅 ARM64 强制创建 GPU 上下文 ==========
  const isARM64 = /arm64|aarch64/.test(navigator.userAgent.toLowerCase());
  if (isARM64) {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2", {
        failIfMajorPerformanceCaveat: true,
        powerPreference: "high-performance",
        antialias: true,
      }) ||
      canvas.getContext("webgl", {
        failIfMajorPerformanceCaveat: true,
        powerPreference: "high-performance",
        antialias: true,
      });

    if (!gl) {
      console.error("ARM64 无法启用GPU渲染！");
      alert("ARM64 设备未启用GPU硬件加速，3D场景可能异常");
    } else {
      console.log("✅ ARM64 GPU上下文已创建");
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.flush();
    }
    canvas.remove();
  }
  // ==============================================
  offRobotFeedback = window.electronAPI?.onRobotFeedback?.((data) => {
    const qActualRad = data.qActual.map((deg) => deg * Math.PI / 180);
    jointArr.value = qActualRad;
    // console.log("页面收到实时关节角度:", data.qActual);
  });
  // 统一初始化场景（双架构通用）
  initScene();
  setupMouseClick();
  window.addEventListener("resize", handleResize);

  // 强制首次渲染（双架构通用）
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
    console.log("✅ 首次渲染触发");
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleResize);
  if (playInterval) clearInterval(playInterval);

  // 容错：判断元素存在再移除
  if (container.value) {
    if (renderer?.domElement && container.value.contains(renderer.domElement)) {
      container.value.removeChild(renderer.domElement);
    }
    if (labelRenderer?.domElement && container.value.contains(labelRenderer.domElement)) {
      container.value.removeChild(labelRenderer.domElement);
    }
  }

  if (renderer) renderer.dispose();

  if (offRobotFeedback) offRobotFeedback();
});
</script>

<style scoped>
.robot-model-container {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.canvas-container {
  width: 100%;
  height: 100%;
  background: linear-gradient(to bottom right, #f0f0f0, #ffffff);
}

.control-panels {
  position: absolute;
  top: 0px;
  left: 0px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 100;
}

.trajectory-controls {
  background: rgba(20, 20, 20, 0.9);
  padding: 12px;
  border-radius: 6px;
  color: #fff;
  font-family: Arial, sans-serif;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.controls-title {
  font-weight: bold;
  margin-bottom: 8px;
  color: #fff;
}

button {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  background: #444;
  color: white;
  font-size: 14px;
  margin-right: 6px;
}

button:hover:not(:disabled) {
  background: #666;
}

button.active {
  background: #2196f3;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.info {
  margin-top: 10px;
  font-size: 13px;
  line-height: 1.6;
  color: #eee;
}

/* Mesh 信息显示面板 */
.mesh-info-panel {
  background: rgba(20, 20, 20, 0.9);
  padding: 12px;
  border-radius: 6px;
  color: #fff;
  font-family: Arial, sans-serif;
}

.mesh-info-panel .controls-title {
  font-weight: bold;
  margin-bottom: 8px;
  color: #fff;
}

.mesh-info-panel p {
  margin: 6px 0;
  font-size: 13px;
  line-height: 1.5;
}

.mesh-info-panel p strong {
  color: #00d4ff;
}

.mesh-info-panel p:last-child {
  font-style: italic;
  color: #aaa;
}
</style>
