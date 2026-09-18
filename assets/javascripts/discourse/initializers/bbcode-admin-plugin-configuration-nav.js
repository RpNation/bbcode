import { withPluginApi } from "discourse/lib/plugin-api";

const PLUGIN_ID = "bbcode";

export default {
  name: "bbcode-admin-plugin-configuration-nav",

  initialize(container) {
    const currentUser = container.lookup("service:current-user");
    if (!currentUser?.admin) {
      return;
    }

    withPluginApi((api) => {
      api.addAdminPluginConfigurationNav(PLUGIN_ID, [
        {
          label: "bbcode.title",
          route: "adminPlugins.show.bbcode-reset",
          description: "bbcode.resetDesc",
        },
      ]);
    });
  },
};
