const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const { log } = require("./logger");

function getMusicFiles() {
  try {
    const candidates = [];

    if (app.isPackaged) {
      // candidates.push(
      //   path.join(process.resourcesPath, "app.asar.unpacked", "public", "music")
      // );
      // candidates.push(path.join(process.resourcesPath, "public", "music"));
      // candidates.push(path.join(__dirname, "../public/music"));

      candidates.push(
        path.join(process.resourcesPath, "assets", "music"), // 对应 extraResources 配置
        path.join(
          process.resourcesPath,
          "app.asar.unpacked",
          "assets",
          "music",
        ), // 兼容 asarUnpack
        path.join(app.getAppPath(), "dist", "assets", "music"), // 备用
      );
    } else {
      // candidates.push(path.join(app.getAppPath(), "public/music"));
      candidates.push(path.join(app.getAppPath(), "src/assets/music"));
    }

    log(`getMusicFiles: 尝试候选目录: ${JSON.stringify(candidates)}`);

    let musicDir = null;
    for (const c of candidates) {
      if (fs.existsSync(c) && fs.statSync(c).isDirectory()) {
        musicDir = c;
        break;
      }
    }

    if (!musicDir) {
      log(`音乐目录未找到，候选目录均不存在`);
      return [];
    }

    log(`读取音乐目录：${musicDir}`);

    //  用 fs.readdirSync 的 withFileTypes 模式，避免编码丢失
    const files = fs
      .readdirSync(musicDir, { withFileTypes: true })
      .filter(
        (dirent) =>
          dirent.isFile() &&
          dirent.name.toLowerCase().endsWith(".mp3") &&
          !dirent.name.startsWith("."),
      )
      .map((dirent) => dirent.name); // 直接获取原始文件名

    const result = [];
    for (const fileName of files) {
      try {
        //   拼接路径，
        const fullPath = path.join(musicDir, fileName);
        //  正确处理中文文件名的 URL 转换
        const fileUrl = new URL(`file:///${fullPath.replace(/\\/g, "/")}`).href;
        //  原始 fileName
        result.push({
          name: fileName.replace(".mp3", ""), // 原始中文文件名
          url: fileUrl,
        });
      } catch (e) {
        log(`处理文件 ${fileName} 失败: ${e.message}`);
      }
    }

    log(
      `找到 ${result.length} 个音乐文件:`,
      result.map((item) => item.name),
    );
    // 包含 name 和 url 的对象
    return result;
  } catch (error) {
    log(`读取音乐文件失败: ${error.message}`);
    log(error.stack);
    return [];
  }
}
module.exports = { getMusicFiles };
