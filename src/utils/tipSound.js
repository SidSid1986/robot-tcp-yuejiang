// src/utils/tipSound.js
import { getCurrentInstance } from "vue";

// ------------- 1. 预加载提示音：映射「名称-音频文件」，所有页面统一按名称调用 -------------
import welcomeTip from "@/assets/tip/欢迎.mp3";
import cleaningTip from "@/assets/tip/正在除灰中.mp3";
import confirmTip from "@/assets/tip/请按确认按钮.mp3";
import setTip from "@/assets/tip/请装入艾条.mp3";
import moveTip from "@/assets/tip/请卸载艾条.mp3";
import checkTip from "@/assets/tip/正在自检中.mp3";
import checkSuccessTip from "@/assets/tip/自检合格.mp3";
import checkFailTip from "@/assets/tip/自检故障.mp3";

// 提示音映射表：key=调用名称，value=音频url（Vite自动处理后的路径）
const TIP_SOUND_MAP = {
  welcomeTip,
  cleaningTip,
  confirmTip,
  setTip,
  moveTip,
  checkTip,
  checkSuccessTip,
  checkFailTip,
};

// ------------- 2. 全局单例Audio实例：避免多页面创建多个实例，防止声音重叠 -------------
let tipAudioInstance = null;
// 初始化音频实例（懒加载，首次播放时创建）
const initAudioInstance = () => {
  if (tipAudioInstance) return tipAudioInstance;
  tipAudioInstance = new Audio();
  tipAudioInstance.volume = 0.7; // 全局默认音量（0-1，可动态修改）
  tipAudioInstance.preload = "metadata"; // 预加载元数据，节省资源
  // 播放结束后重置进度，避免下次播放从中间开始
  tipAudioInstance.addEventListener("ended", () => {
    tipAudioInstance.currentTime = 0;
  });
  // 捕获播放错误，避免控制台报错
  tipAudioInstance.addEventListener("error", (err) => {
    console.warn("提示音播放错误：", err, "音频地址：", tipAudioInstance.src);
  });
  return tipAudioInstance;
};

// ------------- 3. 核心方法：播放提示音 -------------
/**
 * 播放提示音
 * @param {string|URL} sound - 提示音名称（对应TIP_SOUND_MAP的key）或自定义音频url
 * @returns {Promise<boolean>} 播放是否成功
 */
export const playTipSound = async (sound) => {
  if (!sound) {
    console.warn("请传入提示音名称或音频URL");
    return false;
  }
  const audio = initAudioInstance();
  // 处理播放源：如果是名称，取映射表的url；如果是url，直接使用
  const soundUrl =
    typeof sound === "string" && TIP_SOUND_MAP[sound]
      ? TIP_SOUND_MAP[sound]
      : sound;

  try {
    // 停止上一段提示音，重置进度（关键：避免多段重叠）
    audio.pause();
    audio.currentTime = 0;
    // 设置新的音频源
    audio.src = soundUrl;
    // 播放（处理浏览器播放策略限制，必须用await捕获异常）
    await audio.play();
    return true;
  } catch (err) {
    console.warn("提示音播放失败（浏览器播放策略限制）：", err);
    console.info("解决方案：在项目入口页添加「用户点击动作」后再执行播放操作");
    return false;
  }
};

// ------------- 4. 辅助方法：停止播放、设置音量 -------------
/** 停止当前正在播放的提示音 */
export const stopTipSound = () => {
  if (tipAudioInstance) {
    tipAudioInstance.pause();
    tipAudioInstance.currentTime = 0;
  }
};

/**
 * 设置全局提示音音量
 * @param {number} volume - 音量值（0-1，0=静音，1=最大）
 */
export const setTipSoundVolume = (volume) => {
  if (
    tipAudioInstance &&
    typeof volume === "number" &&
    volume >= 0 &&
    volume <= 1
  ) {
    tipAudioInstance.volume = volume;
  }
};

// ------------- 5. 全局注册：挂载到Vue原型，所有页面可通过this.$tipSound直接调用 -------------
export default {
  install: (app) => {
    // 挂载全局方法
    app.config.globalProperties.$tipSound = {
      play: playTipSound,
      stop: stopTipSound,
      setVolume: setTipSoundVolume,
    };
    // 也可通过provide注入，组合式API可直接inject使用
    app.provide("tipSound", {
      play: playTipSound,
      stop: stopTipSound,
      setVolume: setTipSoundVolume,
    });
  },
};
