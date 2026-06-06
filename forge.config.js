/*
 * @Author: Sid Li
 * @Date: 2025-12-08 20:08:40
 * @LastEditors: Sid Li
 * @LastEditTime: 2026-05-23 15:46:16
 * @FilePath: \tcp-demo\forge.config.js
 * @Description:
 */
const { FusesPlugin } = require("@electron-forge/plugin-fuses");
const { FuseV1Options, FuseVersion } = require("@electron/fuses");

module.exports = {
  // 核心打包配置（
  packagerConfig: {
    asar: true,
    // 禁用所有文件过滤规则
    ignore: [],
    // 强制关闭过滤逻辑
    copyIgnore: [],

    platform: "linux",
    arch: "arm64",
    dir: "./",
    out: "./out",
    prune: false, // 关闭依赖清理
    pruneModules: false,
  },
  rebuildConfig: {
    //  arm64 架构的原生依赖
    arch: "arm64",
    platform: "linux",
  },
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {},
    },
    {
      name: "@electron-forge/maker-zip",
      // linux 平台，支持 arm64 打包成 zip
      platforms: ["darwin", "linux"],
    },
    {
      name: "@electron-forge/maker-deb",
      config: {},
    },
    {
      name: "@electron-forge/maker-rpm",
      config: {},
    },
  ],
  plugins: [
    {
      name: "@electron-forge/plugin-auto-unpack-natives",
      config: {},
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
