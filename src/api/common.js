/*
 * @Author: Sid Li
 * @Date: 2025-11-24 10:59:31
 * @LastEditors: Sid Li
 * @LastEditTime: 2026-02-24 14:08:26
 * @FilePath: \tcp-demo-2-12-公司内网最新整理\src\api\common.js
 * @Description:
 */
import request from "@/utils/request.js";

//获取所有方案的列表
export function getCaseList() {
  return request({
    url: "api/load_all",
    method: "get",
  });
}

//获取所有点的列表
export function getPoints() {
  return request({
    url: "api/load_points",
    method: "get",
  });
}

//添加新方案
export function addPlan(data) {
  return request({
    url: "api/save_a_plan",
    method: "post",
    data,
  });
}

//删除方案
export function deletePlan(uuid) {
  return request({
    url: `api/delete_uuid?uuid_value=${uuid}`,
    method: "delete",
  });
}

//export 修改方案
export function updatePlan(uuid_value, data) {
  return request({
    url: `api/update_plan_by_uuid/${uuid_value}`,
    method: "put",
    data,
  });
}

//退出所有
export function quitAll() {
  return request({
    url: "/sys/quit",
    method: "get",
  });
}

//机器人初始化
export function initRobot() {
  return request({
    url: "/sys/robot/init",
    method: "get",
    timeout: 0,
  });
}

//检验数据库状态
export function testDB() {
  return request({
    url: "/api/data/test",
    method: "get",
    timeout: 0,
  });
}

//===========规划中的api==============
//清灰
export function deash(time) {
  return request({
    url: `/api/deashing/${time}`,
    method: "get",
  });
}

//艾条装卸
export function moxaStick() {
  return request({
    url: "/api/moxaStick",
    method: "get",
  });
}

//方案列表
export function getCaseListNew() {
  return request({
    url: "/api/schemes",
    method: "get",
  });
}

//所有点的列表

export function getPointsNew() {
  return request({
    url: "api/acupoints",
    method: "get",
  });
}

//增加方案
export function addPlanNew(data) {
  return request({
    url: "/api/scheme",
    method: "post",
    data,
  });
}

//方案修改
export function updatePlanNew(id, data) {
  return request({
    url: `/api/scheme/${id}`,
    method: "put",
    data,
  });
}

//删除方案新版本测试
export function deletePlanNew(id) {
  return request({
    url: `/api/scheme/${id}`,
    method: "delete",
  });
}

//开始定穴预先位置
export function fixedAcupoint() {
  return request({
    url: "/api/fixedAcupoint",
    method: "get",
  });
}

//回安全位
export function backSafePoint() {
  return request({
    url: "/api/safePoint",
    method: "get",
    timeout: 0,
  });
}

//暂停艾灸
export function execMoxPause() {
  return request({
    url: "/api/execMoxPause",
    method: "get",
  });
}

//启动吸风机
export function startAspirated() {
  return request({
    url: "/sys/device/startAspirated",
    method: "get",
  });
}

//暂停吸风机
export function stopAspirated() {
  return request({
    url: "/sys/device/stopAspirated",
    method: "get",
  });
}

//继续运行艾灸
export function execMoxRun() {
  return request({
    url: "/api/execMoxRun",
    method: "get",
  });
}

//执行治疗的api
export function execMox(data) {
  return request({
    url: "/api/execMox",
    method: "post",
    data,
  });
}

//停止治疗
export function execMoxStop() {
  return request({
    url: "/api/execMoxStop",
    method: "get",
  });
}

//============================================

export function getList() {
  return request({
    url: "api/tasks",
    method: "get",
  });
}
export function deleteList(id) {
  return request({
    url: "api/tasks/" + id,
    method: "delete",
  });
}

export function updateList(id, data) {
  return request({
    url: "api/tasks/" + id,
    method: "put",
    data,
  });
}

//token获取
export function login() {
  return request({
    url: "FreeIeAPI/Login",
    method: "get",
  });
}

export function writeStacking(data) {
  return request({
    url: `FreeIeAPI/WriteStacking`,
    method: "post",
    data,
  });
}

export function editUser(n) {
  return request({
    url: "/api/user",
    method: "put",
    data: n,
  });
}

export function removerUser(n) {
  return request({
    url: "/system/user/" + n,
    method: "DELETE",
  });
}

export function post2DArray(data) {
  return request({
    url: "/api/data",
    method: "post",
    data,
  });
}
