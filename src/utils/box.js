// 点击节流
const throttle = {
  beforeMount: (el, binding) => {
    let throttleTime = binding.value.time || 1000; // 节流时间
    let timer;
    let disable = false;
    el.addEventListener(
      "click",
      (event) => {
        if (timer) {
          clearTimeout(timer);
        }
        if (!disable) {
          // 第一次执行(一点击触发当前事件)
          disable = true;
        } else {
          event && event.stopImmediatePropagation();
        }
        timer = setTimeout(() => {
          timer = null;
          disable = false;
        }, throttleTime);
      },
      true
    );
  },
};

// 点击防抖
const debounce = {
  beforeMount: (el, binding) => {
    let debounceTime = binding.value.time || 1000; // 防抖时间
    let timer;
    el.addEventListener(
      "click",
      (event) => {
        if (timer) {
          clearTimeout(timer);
        }
        timer = setTimeout(() => {
          timer = null;
          // 触发实际点击事件
          binding.value.method();
        }, debounceTime);
      },
      true
    );
  },
};

const setupGlobalMouseUpHandler = (mouseUpCallback) => {
  const handleDocumentMouseUp = () => {
    mouseUpCallback();
    document.removeEventListener("mouseup", handleDocumentMouseUp);
  };
  document.addEventListener("mouseup", handleDocumentMouseUp);
};

// 将两个函数作为默认导出
export { throttle, debounce, setupGlobalMouseUpHandler };
