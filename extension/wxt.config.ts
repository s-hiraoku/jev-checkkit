import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Jev 信憑性チェッカー",
    description: "表示中のページの発行元と本文を、承認済みの Jev チェックリストで検査する",
    permissions: ["sidePanel", "storage", "tabs"],
    host_permissions: ["http://*/*", "https://*/*", "https://api.typesafe.ai/*"],
    options_ui: {
      open_in_tab: true,
    },
    action: {
      default_title: "このタブの信憑性を検査",
    },
    icons: {
      16: "icon-16.png",
      32: "icon-32.png",
      48: "icon-48.png",
      128: "icon-128.png",
    },
  },
});
