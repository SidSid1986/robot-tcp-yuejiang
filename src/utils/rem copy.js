/*
 * @Author: Sid Li
 * @Date: 2025-12-09 15:10:24
 * @LastEditors: Sid Li
 * @LastEditTime: 2026-01-16 09:56:20
 * @FilePath: \zi-xiao-ai\src\utils\rem copy.js
 * @Description:
 */
// src/utils/rem.js
export function setupRemAdaptation() {
  const designWidth = 1920; // 设计稿宽度
  const designHeight = 1080; // 设计稿高度
  const baseFontSize = 10; // 1rem = 设计稿上的 10px
  const designRootFontSize = (designWidth / 100) * baseFontSize;

  function setRootFontSize() {
    // 获取当前屏幕可视尺寸
    const currentWidth =
      document.documentElement.clientWidth || window.innerWidth;
    const currentHeight =
      document.documentElement.clientHeight || window.innerHeight;

    // 计算宽/高比例（以设计稿为基准）
    const widthRatio = currentWidth / designWidth;
    const heightRatio = currentHeight / designHeight;
    // 取最小比例，避免内容溢出
    const scaleRatio = Math.min(widthRatio, heightRatio);

    // 计算实际根字体大小（基于 10px 基准缩放）
    let fontSize = scaleRatio * designRootFontSize;

    //  合理的最小/最大根字体（按 10px 基准推导）
    const minFontSize = 7; // 对应屏幕宽度≈1200px 时，1rem≈7px
    const maxFontSize = 10; // 对应屏幕宽度≥1920px 时，1rem=10px
    fontSize = Math.max(Math.min(fontSize, maxFontSize), minFontSize);

    // 设置根字体
    document.documentElement.style.fontSize = `${fontSize}px`;
    // 兼容 body 字体
    document.body.style.fontSize = "16px"; //
  }

  // 初始化 + 监听窗口缩放
  setRootFontSize();
  window.addEventListener("resize", setRootFontSize);
  // 监听屏幕旋转（移动端兼容）
  window.addEventListener("orientationchange", setRootFontSize);

  return { setRootFontSize };
}
