// src/utils/caseDataManager.js
import originalCaseData from "@/data/caseData.json";

// 本地存储的key
const STORAGE_KEY = "modified_case_data";

//获取最新的case数据（优先从本地存储读取，没有则用原始数据）

export const getCaseData = () => {
  try {
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (storedData) {
      return JSON.parse(storedData);
    }
    // 没有存储数据时，返回原始数据的深拷贝（
    return JSON.parse(JSON.stringify(originalCaseData));
  } catch (error) {
    console.error("读取case数据失败:", error);
    return JSON.parse(JSON.stringify(originalCaseData));
  }
};

//更新并保存case数据到本地存储

export const saveCaseData = (newCaseData) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newCaseData));
    return true;
  } catch (error) {
    console.error("保存case数据失败:", error);
    return false;
  }
};

// 根据ID更新单个case的plan数据

export const updateCasePlan = (caseId, newPlan) => {
  const caseData = getCaseData();
  const targetIndex = caseData.findIndex((item) => item.id * 1 === caseId * 1);

  if (targetIndex === -1) {
    console.error(`未找到ID为${caseId}的case数据`);
    return false;
  }

  // 更新对应case的plan
  caseData[targetIndex].plan = newPlan;
  // 保存到本地存储
  return saveCaseData(caseData);
};

// 根据ID获取单个case

export const getCaseById = (caseId) => {
  const caseData = getCaseData();
  return caseData.find((item) => item.id * 1 === caseId * 1) || null;
};

// 清空本地存储的修改数据

export const clearModifiedCaseData = () => {
  localStorage.removeItem(STORAGE_KEY);
};
