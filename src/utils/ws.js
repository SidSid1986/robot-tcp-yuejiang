/**
 * @description
 * @Author Chaos[3493291628@qq.com]
 * @Date 2025/12/3 14:59
 * @version V1.0.0
 */

// noinspection JSUnusedGlobalSymbols
/**
 * WebSocket 服务器类
 * @param {number} port - 服务器监听的端口号，默认为6789
 * @param {Object} options - 包含服务器配置选项的对象
 * @param {number} options.restartInterval - 重启间隔时间，默认为1000毫秒
 * @param {string} options.heartBeatMessage - 心跳检测消息，默认为'Ping'
 * @param {string} options.heartBeatResponse - 心跳检测响应，默认为'Pong'
 * @param {number} options.heartBeatInterval - 心跳检测间隔时间，默认为1000毫秒
 */
class XPack_WebSocket {
  /**
   * 事件处理函数集合
   * @type {object}
   */
  #_Events = {};
  /////////////////////////////////////////////////////
  /**
   * 端口
   * @type {number}
   */
  #_Port = 6789;
  /**
   * WebSocket 实例
   * @type {WebSocket | null}
   */
  #_Socket = null;
  /////////////////////////////////////////////////////
  /**
   * 重连间隔时间（毫秒）
   * @type {number}
   */
  #_RestartInterval = 1000;
  /**
   * 重连定时器实例
   * @type {number | null}
   */
  #_RestartTimer = null;
  /////////////////////////////////////////////////////
  /**
   * 消息计数功能开启/关闭
   * @type {boolean}
   */
  messageCountEnable = false;
  /**
   * 消息计数
   * @type {number} 当前消息数
   */
  messageCount = 0;
  /**
   * 消息计数起始值
   * @type {number} 起始消息数
   */
  messageCountStart = 0;
  /**
   * 消息计数步长
   * @type {number}
   */
  messageCountStep = 0;
  /**
   * 消息计数结束值
   * @type {number}
   */
  messageCountEnd = 0;
  /////////////////////////////////////////////////////
  /**
   * 心跳检测功能
   * @type {boolean}
   */
  #_HeartBeatEnable = true;
  /**
   * 心跳状态
   * @type {boolean}
   */
  #_HeartBeatStatus = false;
  /**
   * 心跳消息内容
   * @type {string}
   */
  #_HeartBeatMessage = "Ping";
  /**
   * 心跳响应内容
   * @type {string}
   */
  #_HeartBeatResponse = "Pong";
  /**
   * 心跳发送间隔（毫秒）
   * @type {number}
   */
  #_HeartBeatInterval = 1000;
  /**
   * 心跳定时器实例
   * @type {number | null}
   */
  #_HeartBeatTimer = null;
  /**
   * 心跳响应事件处理函数
   * @type {{handle: function(*): void, eventFlag: string}}
   */
  #HeartBeatEventHandle = {
    eventFlag: "HeartBeat",
    handle: (data) => {
      if (data === this.#_HeartBeatResponse) {
        if (this.#_HeartBeatStatus) {
          this.#HeartBeatAction();
        }
      }
    },
  };

  /**
   * 构造函数，用于初始化WebSocket服务器的配置
   * @param {number} port - 服务器监听的端口号，默认为6789
   * @param {Object} [options] - 包含服务器配置选项的对象
   * @param {number} [options.restartInterval] - 重启间隔时间，默认为1000毫秒
   * @param {boolean} [options.messageCountEnable] - 是否启用消息计数功能，默认为false
   * @param {number} [options.messageCountStart] - 消息计数起始值，默认为0
   * @param {number} [options.messageCountStep] - 消息计数步长，默认为1
   * @param {number} [options.messageCountEnd] - 消息计数结束值，默认为 Number.MAX_SAFE_INTEGER
   * @param {boolean} [options.heartBeatEnable] - 是否启用心跳检测，默认为true
   * @param {string} [options.heartBeatMessage] - 心跳检测消息，默认为'Ping'
   * @param {string} [options.heartBeatResponse] - 心跳检测响应，默认为'Pong'
   * @param {number} [options.heartBeatInterval] - 心跳检测间隔时间，默认为1000毫秒
   */
  constructor(port = 6789, options = {}) {
    this.#_Port = port || 6789;
    this.#_RestartInterval = options.restartInterval || 1000;

    this.messageCountEnable = options.messageCountEnable || false;
    this.messageCountStart = options.messageCountStart || 0;
    this.messageCountStep = options.messageCountStep || 1;
    this.messageCountEnd = options.messageCountEnd || Number.MAX_SAFE_INTEGER;

    this.#_HeartBeatEnable = options.heartBeatEnable || true;
    this.#_HeartBeatMessage = options.heartBeatMessage || "Ping";
    this.#_HeartBeatResponse = options.heartBeatResponse || "Pong";
    this.#_HeartBeatInterval = options.heartBeatInterval || 10 * 1000;

    this.EventAdd(
      this.#HeartBeatEventHandle.eventFlag,
      this.#HeartBeatEventHandle.handle,
    );
  }

  /**
   * 获取连接状态
   * @returns {null|boolean} 连接状态，true 表示连接成功，false 表示连接失败或未连接
   */
  get Status() {
    return this.#_Socket && this.#_Socket.readyState === WebSocket.OPEN;
  }

  /**
   * 事件订阅
   * @param {string} event - 事件名称
   * @param {Function} handler - 事件处理函数
   * @param {boolean} [once] - 单次
   */
  EventAdd(event, handler, once = false) {
    if (!this.#_Events[event]) {
      this.#_Events[event] = {
        handler: handler,
        once: once,
      };
    }
  }

  /**
   * 事件触发
   * @param {string} event - 事件名称
   * @param {...*} args - 事件参数
   */
  EventTrigger(event, ...args) {
    if (this.#_Events[event]) {
      this.#_Events[event].handler(...args);
      if (this.#_Events[event].once) this.EventRemove(event);
    }
  }

  /**
   * 打印当前事件监听列表
   * @param {string} [event] 事件名称
   */
  EventCheckString(event) {
    if (event) {
      if (this.#_Events[event])
        console.log(
          `EventTrigger - Key: ${event}, Handler: ${this.#_Events[event].handler}, Once: ${this.#_Events[event].once}`,
        );
      else console.log(`EventTrigger - Key: ${event}, Not Found`);
      return;
    }
    for (let key in this.#_Events) {
      if (this.#_Events.hasOwnProperty(key)) {
        console.log(
          `现在:EventTrigger - Key: ${key}, Handler: ${this.#_Events[key].handler}, Once: ${this.#_Events[key].once}`,
        );
      }
    }
  }

  /**
   * 移除事件监听
   * @param {string} event - 事件名称
   */
  EventRemove(event) {
    if (this.#_Events[event]) {
      delete this.#_Events[event];
    }
  }

  /**
   * 重连启动
   */
  #RestartStart() {
    this.#_RestartTimer = setTimeout(() => {
      this.#_Socket = null;
      console.log("WebSocket 服务器连接失败，正在尝试重新连接...");
      this.Connect();
    }, this.#_RestartInterval);
  }

  /**
   * 重连停止
   */
  #RestartStop() {
    if (this.#_RestartTimer) {
      clearTimeout(this.#_RestartTimer);
      this.#_RestartTimer = null;
    }
  }

  /**
   * 心跳动作
   */
  #HeartBeatAction() {
    this.#_HeartBeatTimer = setTimeout(() => {
      if (this.#_Socket && this.#_Socket.readyState === WebSocket.OPEN) {
        this.Send({
          eventFlag: this.#HeartBeatEventHandle.eventFlag,
          data: this.#_HeartBeatMessage,
        });
        this.#_HeartBeatTimer = null;
      }
    }, this.#_HeartBeatInterval);
  }

  /**
   * 启动心跳检测
   */
  HeartBeatStart() {
    if (!this.#_HeartBeatStatus) {
      this.#_HeartBeatStatus = true;
      this.#HeartBeatAction();
    }
  }

  /**
   * 停止心跳检测
   */
  HeartBeatStop() {
    if (this.#_HeartBeatStatus) {
      this.#_HeartBeatStatus = false;
      if (this.#_HeartBeatTimer) {
        clearTimeout(this.#_HeartBeatTimer);
        this.#_HeartBeatTimer = null;
      }
    }
  }

  /////////////////////////////////////////////////////
  /**
   * 连接成功【回调函数】
   * @param event - 连接成功事件对象
   */
  OnOpen(event) {
    console.log("Websocket 服务器连接成功：", event);
    this.#RestartStop();
    if (this.#_HeartBeatEnable) this.HeartBeatStart();
  }

  /**
   * 收到服务器消息【回调函数】
   * @param event - 收到服务器消息的事件对象
   */
  OnMessage(event) {
    try {
      const jsonData = JSON.parse(event.data);
      // noinspection JSUnresolvedReference
      if (jsonData.res_id) {
        this.EventTrigger(jsonData.res_id, jsonData);
      }
    } catch (e) {
      console.log(
        "服务器[WebSocket]：数据[" +
          event.data +
          "]解析失败，请检查数据格式是否正确！",
      );
    }
  }

  /**
   * 连接关闭【回调函数】
   * @param event - 连接关闭事件对象
   */
  OnClose(event) {
    console.log("Websocket 服务器连接关闭：", event.reason);
    this.HeartBeatStop();
    if (event.reason !== "ServerShutDown") {
      this.#RestartStart();
    }
  }

  /**
   * 发生错误【回调函数】
   * @param error - 错误对象
   */
  OnError(error) {
    console.error("Websocket 服务器发生错误：", error);
  }

  /////////////////////////////////////////////////////

  /**
   * 建立与服务器的连接
   */
  Connect() {
    // this.#_Socket = new WebSocket(`ws://192.168.3.29:${this.#_Port}`);

    // this.#_Socket = new WebSocket(`ws://192.168.3.65:${this.#_Port}/ws`); //新版机器人
    this.#_Socket = new WebSocket(`ws://192.168.3.230:${this.#_Port}/ws`); //新版机器人最新地址
    // this.#_Socket = new WebSocket(`ws://localhost:${this.#_Port}/ws`); //机器人本地
    // this.#_Socket = new WebSocket(`ws://127.0.0.1:${this.#_Port}`);
    this.#_Socket.onopen = (event) => this.OnOpen(event);
    this.#_Socket.onmessage = (event) => this.OnMessage(event);
    this.#_Socket.onclose = (event) => this.OnClose(event);
    this.#_Socket.onerror = (error) => this.OnError(error);
  }

  /**
   * 关闭与服务器的连接
   */
  Close() {
    this.HeartBeatStop();
    if (this.#_Socket) {
      this.#_Socket.close();
      this.#_Socket = null;
    }
  }

  /**
   * 发送消息
   * @param message - 要发送的消息
   */
  Send(message) {
    if (this.#_Socket && this.#_Socket.readyState === WebSocket.OPEN) {
      this.#_Socket.send(JSON.stringify(message));
      return true;
    }
    console.log("Websocket 尚未连接，请稍后再试...");
    return false;
  }

  /**
   * 发送回调消息
   * @param {string} command - 要发送的命令
   * @param {string} args - 命令参数
   * @param {Function} func_handler - 回调函数
   */
  SendMessage(command, args, func_handler) {
    if (this.messageCountEnable === false) {
      console.log("messageCountEnable is false");
      return;
    }

    this.messageCount += 1;
    if (this.messageCount >= this.messageCountEnd) {
      this.messageCount = this.messageCountStart;
    }
    let message = {
      req_id: this.messageCount.toString(),
      command: command,
      args: args,
    };
    this.EventAdd(message.req_id, func_handler, true);
    return this.Send(message);
  }
}

/**
 * 默认WebSocket服务
 * @param {import('vue').App} app - Vue 应用实例
 * @param {Object} options - 包含服务器配置选项的对象
 * @param {number} options.port - 服务器监听的端口号，默认为6789
 * @param {Object} options.options - 包含服务器配置选项的对象
 * @param {number} options.options.restartInterval - 重启间隔时间，默认为1000毫秒
 * @param {string} options.options.heartBeatMessage - 心跳检测消息，默认为'Ping'
 * @param {string} options.options.heartBeatResponse - 心跳检测响应，默认为'Pong'
 * @param {number} options.options.heartBeatInterval - 心跳检测间隔时间，默认为1000毫秒
 */
// let XPack_WebSocketDefault = function (app, options = {}) {
//     app.config.globalProperties.$XPack_WebSocket = new XPack_WebSocket(
//         options.port,
//         options.options
//     );
//     app.config.globalProperties.$XPack_WebSocket.Connect();
// };

/**
 * 默认WebSocket服务导出
 */
// export default  XPack_WebSocketDefault;

export default XPack_WebSocket;
