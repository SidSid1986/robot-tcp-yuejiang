import CryptoJS from "crypto-js";
import router from "@/router";
import { nextTick } from "vue";

const SECRET_KEY =
  "1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f";

// 加密
export function encrypt(data) {
  return CryptoJS.AES.encrypt(JSON.stringify(data), SECRET_KEY).toString();
}

// 解密
export function decrypt(cipherText) {
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, SECRET_KEY);
    const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
    if (!decryptedData) {
      // localStorage.clear();
      const keyToKeep = "token";

      // 遍历 localStorage 中的所有键
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key !== keyToKeep) {
          localStorage.removeItem(key);
        }
      }
    }
    return JSON.parse(decryptedData);
  } catch (error) {
    console.log(`Decryption error: ${error.message}`);
    // localStorage.clear();
    const keyToKeep = "token";

    // 遍历 localStorage 中的所有键
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key !== keyToKeep) {
        localStorage.removeItem(key);
      }
    }
  }
}
