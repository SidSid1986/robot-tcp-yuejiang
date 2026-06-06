/*
 * @Author: Sid Li
 * @Date: 2025-12-09 15:10:24
 * @LastEditors: Sid Li
 * @LastEditTime: 2025-12-19 10:00:47
 * @FilePath: \zi-xiao-ai\src\utils\volume.js
 * @Description:
 */
/*
 * @Author: Sid Li
 * @Date: 2025-12-06 08:28:51
 * @LastEditors: Sid Li
 * @LastEditTime: 2025-12-06 08:29:13
 * @FilePath: \ai\src\utils\volume.js
 * @Description:
 */
/**
 * 音量控制工具类
 *
 */

//  1.  自动 Electron 环境识别
export const isElectron = (() => {
  if (typeof window === "undefined") return false;

  // 多重检测，确保识别准确
  const checkList = [
    window.process?.type === "renderer", // Electron 渲染进程标识
    !!window.electronAPI, // 自定义暴露的 Electron API
    navigator.userAgent?.includes("Electron"), // UA 包含 Electron
    !!window.require && typeof window.require === "function", // Electron 特有 require
  ];

  return checkList.some(Boolean);
})();

//  2. 仅 Electron 加载 loudness
let loudness = null;
if (isElectron) {
  try {
    // Electron 渲染进程安全加载 loudness
    loudness = window.require("loudness");
    console.log(" Electron 环境 - loudness 加载成功");
  } catch (error) {
    console.error("Electron 环境 - loudness 加载失败:", error);
    loudness = null;
  }
}

//   3. 模拟状态（网页环境用）
const mockVolumeState = { volume: 50, muted: false };

//  4. 方法（全自动适配）
/**
 * 设置音量（自动分环境）
 * @param {number} val - 音量值 0-100
 */
export function setVol(val = 45) {
  const validVal = Math.max(0, Math.min(100, Number(val)));

  if (isElectron && loudness) {
    // Electron：真正控制系统音量
    loudness.setVolume(validVal);
    loudness.setMuted(false); // 调音量自动取消静音
  } else {
    // 网页：仅更新模拟状态（实际播放器音量由组件控制）
    mockVolumeState.volume = validVal;
    mockVolumeState.muted = false;
  }
}

/**
 * 获取音量（自动分环境）
 * @returns {Promise<number>} 音量值 0-100
 */
export async function getVol() {
  if (isElectron && loudness) {
    // Electron：获取系统真实音量
    return await loudness.getVolume();
  } else {
    // 网页：返回模拟值
    return Promise.resolve(mockVolumeState.volume);
  }
}
