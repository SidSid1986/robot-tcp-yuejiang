/*
 * @Author: Sid Li
 * @Date: 2025-11-29 10:30:04
 * @LastEditors: Sid Li
 * @LastEditTime: 2026-05-19 17:29:11
 * @FilePath: \tcp-demo\src\router\index.js
 * @Description:
 */
import { createWebHashHistory, createRouter } from "vue-router";
import { ElMessage } from "element-plus";

const routes = [
  {
    path: "/",
    redirect: { name: "Load" },
  },
  {
    path: "/load",
    name: "Load",
    component: () => import("@/views/load.vue"),
    meta: {
      requiresAuth: false,
      roles: ["admin", "user", "super_admin"],
    },
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    return savedPosition || { top: 0, left: 0 };
  },
});

export default router;
