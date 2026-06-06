import { createPinia } from "pinia";
//持久化
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";

const store = createPinia();

//持久化
store.use(piniaPluginPersistedstate);

export default store;
