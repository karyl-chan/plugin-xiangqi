import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
// @karyl-chan/ui tokens supply the colour palette AppButton / AppModal
// expect. The shared reset.css is intentionally skipped — it locks
// body scroll for the bot frontend's sidebar-driven layout, which
// would prevent the xiangqi page from scrolling when content overflows.
import "@karyl-chan/ui/tokens.css";
import "@karyl-chan/ui/use-drawer.css";
import "@karyl-chan/ui/use-popover.css";
import "./styles.css";

createApp(App).use(createPinia()).mount("#app");
