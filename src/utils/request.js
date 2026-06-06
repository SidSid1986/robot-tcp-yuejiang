import axios from "axios";

const service = axios.create({
  baseURL: "/", // 设置基础 URL，根据实际情况修改 '/接口前缀', //import.meta.env.VITE_APP_API_HOST
  // baseURL: import.meta.env.VITE_APP_API_HOST,
  // baseURL: "/FreeIeAPI", // 使用代理前缀
  port: 5173,
  headers: { "Content-Type": "application/json;charset=utf-8" },
  timeout: 30000, // 设置请求超时时间
});

// 请求拦截器
service.interceptors.request.use(
  (config) => {
    console.log(config + "config");
    // 在请求发送之前做一些处理，例如添加 token 等
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
service.interceptors.response.use(
  (response) => {
    console.log(response + "response");
    // 在响应数据返回之前做一些处理
    return response.data;
  },
  (error) => {
    return Promise.reject(error);
  }
);
export default service;
