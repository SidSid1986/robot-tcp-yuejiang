<!-- components/CustomTitleBar.vue -->
<template>
  <div class="custom-title-bar" :class="{ hidden: isFullScreen }">
    <!-- 图标和标题 -->
    <div class="title-section">
      <!-- <img src="/home.png" alt="图标" class="window-icon" /> -->
      <span class="window-title">Demo</span>
    </div>

    <!-- 窗口控制按钮 -->
    <div class="window-controls">
      <button @click="minimizeWindow" class="control-btn minimize">
        <i class="iconfont icon-chuangkouzuixiaohua"></i>
      </button>
      <button @click="maximizeWindow" class="control-btn maximize">
        <i class="iconfont icon-chuangkouzuidahua"></i>
      </button>
      <button @click="closeWindow" class="control-btn close">
        <i class="iconfont icon-delete_line"></i>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { quitAll, backSafePoint } from "@/api/common.js";
import { ElMessage, ElMessageBox, ElLoading } from "element-plus";

const memoryUsage = ref({ used: "0", total: "0" });
const isFullScreen = ref(false);

// 存储监听移除函数
let removeMemoryListener = null;
let removeFullscreenListener = null;

// 窗口控制方法
const minimizeWindow = () => {
  window.electronAPI?.minimizeWindow();
};

const maximizeWindow = () => {
  window.electronAPI?.maximizeWindow();
};

const closeWindow = () => {
  ElMessageBox.confirm("确定要关机吗？", "提示", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    customClass: "close-confirm",
    type: "warning",
  })
    .then(async () => {
      const loading = ElLoading.service({
        lock: true,
        text: "正在关机中",
        background: "rgba(216, 199, 229, 0.8)",
      });


      // 断开连线，下使能
      await window.electronAPI.disconnectRobot();
      await window.electronAPI.disableRobot();

      // quitAll().then(() => {
      //   // window.electronAPI?.closeWindow();
      // });
      window.electronAPI?.closeWindow();
    })
    .catch(() => {
      ElMessage.info("已取消关机操作");
    });
};

onMounted(() => {
  if (window.electronAPI) {
    // 监听内存使用 
    removeMemoryListener = window.electronAPI.onMemoryUsage((data) => {
      if (data && typeof data === "object") {
        memoryUsage.value = {
          used: data.used || "0",
          total: data.total || "0",
        };
      }
    });

    // 监听全屏状态 
    removeFullscreenListener = window.electronAPI.onFullScreenStatus((data) => {
      isFullScreen.value = data?.isFullScreen || false;
    });
  }
});

onUnmounted(() => {
  // 正确移除监听
  if (removeMemoryListener) removeMemoryListener();
  if (removeFullscreenListener) removeFullscreenListener();
  //断开连线，下使能

});
</script>

<style scoped lang="scss">
.custom-title-bar {
  height: 4vh;
  background-color: #262624;
  color: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  -webkit-app-region: drag; // 允许拖动标题栏
  // -webkit-app-region: no-drag;// 不允许拖动标题栏

  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  user-select: none;
  transition: opacity 0.3s, transform 0.3s;
  box-sizing: border-box;
}

/* 全屏时隐藏标题栏 */
.custom-title-bar.hidden {
  opacity: 0;
  transform: translateY(-100%);
  pointer-events: none;

}

.title-section {
  display: flex;
  align-items: center;

  img {
    width: 30px;
    height: 30px;
    margin-right: 10px;
  }
}

.window-icon {
  width: 20px;
  height: 20px;
  border-radius: 4px;
}

.window-title {
  font-size: 20px;
  font-weight: 500;
}

.window-controls {
  display: flex;

  -webkit-app-region: no-drag;
}

.control-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 4px;
  color: white;
  background-color: #262624;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  transition: background-color 0.2s;
  margin-left: 20px;


  i {
    font-size: 20px;
  }
}

.control-btn:hover {
  background-color: #555;
}

.control-btn.close:hover {
  background-color: #ff3b30;
}

:global(body) {
  overflow: hidden;
}

:global(html) {
  overflow: hidden;
  height: 100%;
}

:global(#app) {
  height: 100%;
  overflow: hidden;
}
</style>

<style lang="scss">
.close-confirm {
  font-size: 20px !important;

  .el-message-box__container {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    height: 5vh;

    .el-icon {
      font-size: 24px;
    }
  }

  .el-message-box__title {
    font-size: 24px !important;
    font-weight: bold;
    margin-bottom: 15px !important;
  }

  .el-message-box__message {
    font-size: 22px !important;
    display: flex;
    flex-direction: row;
    align-items: center;
  }

  .el-message-box__btns .el-button {
    padding: 14px 25px !important;
    font-size: 20px !important;
    border-radius: 8px !important;
    min-width: 80px !important;
    height: auto !important;
  }

  .el-message-box__btns .el-button--primary {
    background-color: #262624 !important;
    border-color: #262624 !important;
    color: #fff !important;
  }

  .el-message-box__btns .el-button--primary:hover {
    background-color: #262624 !important;
    border-color: #262624 !important;
  }

  .el-message-box__btns .el-button--default {
    font-size: 20px !important;
    border-color: #ddd !important;
  }
}
</style>
