<!--
 * @Author: Sid Li
 * @Date: 2025-11-29 10:30:03
 * @LastEditors: Sid Li
 * @LastEditTime: 2026-05-21 16:18:35
 * @FilePath: \tcp-demo\src\App.vue
 * @Description: 
-->
<!-- App.vue -->
<template>
  <div id="app">
    <!-- 自定义标题栏 -->

    <!-- 主内容区域 -->
    <div class="main-content" :class="{ fullscreen: isFullScreen }">
      <div class="custom-title" v-if="!isFullScreen">
        <CustomTitleBar />
      </div>
      <router-view />
    </div>
  </div>
</template>

<script setup>
import CustomTitleBar from "./components/CustomTitleBar.vue";
import { ref, onMounted, onUnmounted } from "vue";

// 监听全屏状态，优化内容显示
const isFullScreen = ref(false);
let removeFullscreenListener = null;

onMounted(() => {
  if (window.electronAPI) {
    // 只监听全屏状态（App.vue不需要内存数据）
    removeFullscreenListener = window.electronAPI.onFullScreenStatus((data) => {
      isFullScreen.value = data?.isFullScreen || false;
    });
  }
});

onUnmounted(() => {
  if (removeFullscreenListener) removeFullscreenListener();
});
</script>

<style>
/* 原有样式 */
.main-content {
  height: 100vh;
  box-sizing: border-box;
  position: relative;
  /* transition: all 0.3s ease; */
  /* overflow: hidden ; */
  /* background: blue; */
}

.main-content.fullscreen {
  height: 100vh;
}

.custom-title {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
}

/* 全局样式，确保没有滚动条 */
html,
body,
#app {
  margin: 0;
  padding: 0;
  /* ::-webkit-scrollbar {
    display: none;
  } */


  /* 全局统一美化滚动条 */
  /* ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: #262624;
  
  }

  ::-webkit-scrollbar-thumb {
    background: #555550;
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: #707070;
  } */
}
</style>
