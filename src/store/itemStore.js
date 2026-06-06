import { defineStore } from "pinia";

export const useOneItemStore = defineStore("oneItemStore", {
  state: () => ({
    count: 555,
    // point: 10,
    oneItemTest: {},
  }),
  getters: {
    // double: (state) => state.count * 2,
  },
  actions: {
    increment(val) {
      // this.count++;
      // this.point += val;
    },
    setOneItemTest(val) {
      this.oneItemTest = val;
      this.count = val.id;
    },
  },

 

  persist: true, //持久化

  // // 定义一个storage的key
  // persist: {
  //   key: "oneItemTest_store",
  // },

  //配置到sessionstorage，默认的local
  // persist: {
  //   storage: sessionStorage,
  // },

  // persist: [
  //   {
  //     pick: ['count'],
  //     storage: localStorage,
  //     key: 'count_store',
  //   },
  //   {
  //     pick: ['oneItemTest'],
  //     storage: sessionStorage,
  //     key: 'oneItemTest_store',

  //   },
  // ],
});
