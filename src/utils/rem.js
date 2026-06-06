/*
 * @Author: Sid Li
 * @Date: 2025-12-09 15:10:24
 * @LastEditors: Sid Li
 * @LastEditTime: 2026-01-16 09:49:52
 * @FilePath: \zi-xiao-ai\src\utils\rem.js
 * @Description: REM 适配（严格保留1920px逻辑，仅高分辨率屏幕放大）
 */
export function setupRemAdaptation() {
  const designWidth = 1920; // 设计稿宽度
  const designHeight = 1080; // 设计稿高度
  const baseFontSize = 10; // 1rem = 设计稿上的 10px
  const designRootFontSize = (designWidth / 100) * baseFontSize;

  // 定义分辨率阈值和对应的放大系数（按需调整）
  const resolutionConfig = {
    2560: 1.2, // 2K屏幕（≥2560px）：放大1.2倍
    3840: 1.4, // 4K屏幕（≥3840px）：放大1.4倍
    7680: 1.6, // 8K屏幕（可选）：放大1.6倍
  };
  // 定义不同分辨率的字体上限
  const fontSizeMaxConfig = {
    default: 10, // ＜2560px（含1920px）：保留原有上限10px
    2560: 12, // 2K屏幕：上限12px（10*1.2）
    3840: 14, // 4K屏幕：上限14px（10*1.4）
    7680: 16, // 8K屏幕：上限16px（10*1.6）
  };

  function setRootFontSize() {
    // 获取当前屏幕可视尺寸
    const currentWidth =
      document.documentElement.clientWidth || window.innerWidth;
    const currentHeight =
      document.documentElement.clientHeight || window.innerHeight;

    // 1. 计算宽高最小比例
    const widthRatio = currentWidth / designWidth;
    const heightRatio = currentHeight / designHeight;
    let scaleRatio = Math.min(widthRatio, heightRatio);

    // 2. 严格判断分辨率，仅高分辨率屏幕放大
    let zoomFactor = 1; // 默认不放大（＜2560px屏幕保持1）
    let currentMaxFontSize = fontSizeMaxConfig.default; // 默认上限10px
    // 从大到小判断，确保只匹配最高分辨率阈值
    if (currentWidth >= 7680) {
      zoomFactor = resolutionConfig[7680];
      currentMaxFontSize = fontSizeMaxConfig[7680];
    } else if (currentWidth >= 3840) {
      zoomFactor = resolutionConfig[3840];
      currentMaxFontSize = fontSizeMaxConfig[3840];
    } else if (currentWidth >= 2560) {
      zoomFactor = resolutionConfig[2560];
      currentMaxFontSize = fontSizeMaxConfig[2560];
    }
    // 仅高分辨率屏幕叠加放大系数，1920px屏幕zoomFactor=1，scaleRatio不变
    scaleRatio = scaleRatio * zoomFactor;

    // 3. 计算实际根字体大小
    let fontSize = scaleRatio * designRootFontSize;

    // 4.根据分辨率使用对应字体上限，1920px屏幕上限仍为10px
    const minFontSize = 7; // 小屏幕最小字体（不变）
    fontSize = Math.max(Math.min(fontSize, currentMaxFontSize), minFontSize);

    // 5. 设置根字体和body字体
    document.documentElement.style.fontSize = `${fontSize}px`;
    document.body.style.fontSize = "16px";
  }

  // 初始化 + 监听窗口缩放/屏幕旋转
  setRootFontSize();
  window.addEventListener("resize", setRootFontSize);
  window.addEventListener("orientationchange", setRootFontSize);

  return { setRootFontSize };
}
