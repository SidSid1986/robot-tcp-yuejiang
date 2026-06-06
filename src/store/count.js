import { defineStore } from "pinia";

export const useTestStore = defineStore("test", {
  state: () => ({
    // count:0,
    // point: 10,
    isConnectedValue: false,
    IPvalueValue: "",
    chargeImgValue: "",
    robotModeValue: false,
    capacityValue: 0,
    voltageValue: 0,
    robotMode: -1,
  }),
  getters: {
    // double: (state) => state.count * 2,
  },
  actions: {
    increment(val) {
      // this.count++;
      // this.point += val;
    },
    // updateConnectionStatus(data) {
    //   this.isConnected = data.internet.IsConnected;
    //   this.IPvalue = data.internet.IpAddress;
    //   this.chargeImg = data.charging ? charginImg : capacityImg;
    // },
  },

  persist: {
    key: "main_store",
    storage: localStorage,
  },

  // persist: true, //持久化

  //定义一个storage的key
  // persist: {
  //   key: "my-test-key",
  // },

  //配置到sessionstorage，默认的local
  // persist: {
  //   storage: sessionStorage,
  // },
});
