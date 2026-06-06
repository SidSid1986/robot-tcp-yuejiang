const { log } = require("./logger");
const { exec } = require("child_process");

let loudness = null;
try {
  loudness = require("loudness");
  log("loudness 加载成功");
} catch (error) {
  log(`loudness 加载失败: ${error.message}`);
  loudness = {
    getVolume: async () => 0.5,
    setVolume: async () => {},
  };
}

async function getSystemVolume() {
  try {
    if (process.platform === "win32" || process.platform === "linux") {
      const volume = await loudness.getVolume();
      return volume / 100;
    }
    return 0.5;
  } catch (error) {
    log(`获取系统音量失败: ${error.message}`);
    if (process.platform === "linux") checkLinuxDependencies();
    return 0.5;
  }
}

async function setSystemVolume(value) {
  try {
    if (process.platform === "win32" || process.platform === "linux") {
      const volume = Math.round(value * 100);
      const clamped = Math.max(0, Math.min(100, volume));
      await loudness.setVolume(clamped);
    }
  } catch (error) {
    log(`设置系统音量失败: ${error.message}`);
    if (process.platform === "linux") checkLinuxDependencies();
  }
}

function checkLinuxDependencies() {
  exec("which pactl", (error) => {
    if (error) {
      log("警告: Linux 未找到 pactl");
    }
  });
}

module.exports = { getSystemVolume, setSystemVolume }