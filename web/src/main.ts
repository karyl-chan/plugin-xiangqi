import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
// @karyl-chan/ui token + reset CSS first — local styles.css layered after
// so the xiangqi board colours override the shared defaults.
import "@karyl-chan/ui/tokens.css";
import "@karyl-chan/ui/reset.css";
import "@karyl-chan/ui/use-drawer.css";
import "@karyl-chan/ui/use-popover.css";
import "./styles.css";

createApp(App).use(createPinia()).mount("#app");
