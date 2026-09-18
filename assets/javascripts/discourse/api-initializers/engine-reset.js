import { apiInitializer } from "discourse/lib/api";
import { i18n } from "discourse-i18n";

const RESET_CHANNEL = "/bbcode/engine-reset";

export default apiInitializer((api) => {
  api.container.lookup("service:message-bus").subscribe(RESET_CHANNEL, () => {
    // The markdown-it feature is baked into the app bundle, so a reload is the
    // only way to pick it up
    api.addGlobalNotice(i18n("bbcode.reload_notice"), "bbcode-engine-reset", {
      dismissable: true,
      level: "info",
      persistentDismiss: false,
    });
  });
});
