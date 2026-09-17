import { withPluginApi } from "discourse/lib/plugin-api";
import { createDisclosureDecorator } from "../lib/bbcode-disclosures";

export const addSpoilerCode = createDisclosureDecorator({
  selector: "details.bb-spoiler",
  duration: 200,
  easing: "ease-in-out",
});

export default {
  name: "bbcode-spoiler",
  initialize() {
    withPluginApi((api) => {
      if (api.container.lookup("service:site-settings").bbcode_enabled) {
        api.decorateCookedElement(addSpoilerCode);
      }
    });
  },
};
