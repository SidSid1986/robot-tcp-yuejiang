/*
 * @Author: Sid Li
 * @Date: 2025-12-08 08:30:08
 * @LastEditors: Sid Li
 * @LastEditTime: 2026-05-20 10:10:06
 * @FilePath: \tcp-demo\src\main.js
 * @Description:
 */
import { createApp } from "vue";
import App from "./App.vue";
import ElementPlus from "element-plus";
import zhCn from "element-plus/dist/locale/zh-cn.mjs";

//  第一步：先导入 Element Plus 源码样式
import "element-plus/theme-chalk/src/index.scss";
// 第二步：立即导入自定义主题（覆盖变量，顺序）
import "@/styles/element/index.scss";
// 第三步：导入其他样式
import "@/styles/main.scss";
import "@/styles/free-icons/iconfont.css";

import * as ElementPlusIconsVue from "@element-plus/icons-vue";
import router from "@/router/index.js";
import store from "@/store";
import { setupRemAdaptation } from "@/utils/rem";
import XPack_WebSocket from "@/utils/ws";

// 实例化 WebSocket
// const webSocketInstance = new XPack_WebSocket(8000, {
//   heartBeatEnable: false,
//   messageCountEnable: true,
// });

// REM 适配
if (typeof document !== "undefined") {
  setupRemAdaptation();
}

// 连接 WebSocket
// if (typeof window !== "undefined") {
//   webSocketInstance.Connect();
// }

function bootstrapApp() {
  const app = createApp(App);
  app.use(store);
  //  只注册组件，不自动导入任何样式
  app.use(ElementPlus, {
    locale: zhCn,
    importStyle: false, // 彻底关闭自动样式导入
  });
  app.use(router);

  // 全局注册 WebSocket
  // app.provide("$ws", webSocketInstance);

  // 注册图标
  for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component);
  }

  // 挂载应用
  const appDom = document.getElementById("app");
  if (appDom) {
    app.mount(appDom);
  } else {
    setTimeout(bootstrapApp, 100);
  }
}

bootstrapApp();
