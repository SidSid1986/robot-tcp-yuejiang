import { ElMessage } from "element-plus";
import router from "@/router/index.js";

// 自定义事件名称
const LOCAL_STORAGE_CHANGE_EVENT = "local-storage-changed";

const useLocalStorageListener = () => {
  const handleStorageChange = (event) => {
    // console.log("加载监听");
    const { isCodeModification } = event.detail;
    if (isCodeModification) {
      // ElMessage({
      //   grouping: true,
      //   message: "local修改",
      //   type: "success",
      // });
    } else {
      ElMessage({
        grouping: true,
        message: "不允许修改local数据",
        type: "warning",
      });
      // localStorage.clear();
      const keyToKeep = "token";

      // 遍历 localStorage 中的所有键
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key !== keyToKeep) {
          localStorage.removeItem(key);
        }
      }
      router.push("/load");
    }
    // 可以在这里添加其他处理逻辑，如更新状态等
  };

  // 重写 localStorage 的 setItem 方法
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = (key, value) => {
    originalSetItem.call(localStorage, key, value);
    const event = new CustomEvent(LOCAL_STORAGE_CHANGE_EVENT, {
      detail: { isCodeModification: true },
    });
    window.dispatchEvent(event);
  };

  // 重写 localStorage 的 removeItem 方法
  const originalRemoveItem = localStorage.removeItem;
  localStorage.removeItem = (key) => {
    originalRemoveItem.call(localStorage, key);
    const event = new CustomEvent(LOCAL_STORAGE_CHANGE_EVENT, {
      detail: { isCodeModification: true },
    });
    window.dispatchEvent(event);
  };

  // 监听 storage 事件，用于检测不同窗口间的修改（可能是人工 F12 修改）
  const storageEventListener = (event) => {
    if (event.storageArea === localStorage) {
      const customEvent = new CustomEvent(LOCAL_STORAGE_CHANGE_EVENT, {
        detail: { isCodeModification: false },
      });
      window.dispatchEvent(customEvent);
    }
  };

  // 监听自定义事件
  const customEventListener = (event) => handleStorageChange(event);

  window.addEventListener("storage", storageEventListener);
  window.addEventListener(LOCAL_STORAGE_CHANGE_EVENT, customEventListener);

  // 在页面卸载时移除事件监听器
  const beforeUnloadListener = () => {
    window.removeEventListener("storage", storageEventListener);
    window.removeEventListener(LOCAL_STORAGE_CHANGE_EVENT, customEventListener);
  };

  window.addEventListener("beforeunload", beforeUnloadListener);

  return () => {
    window.removeEventListener("beforeunload", beforeUnloadListener);
    window.removeEventListener("storage", storageEventListener);
    window.removeEventListener(LOCAL_STORAGE_CHANGE_EVENT, customEventListener);
  };
};

export default useLocalStorageListener;
