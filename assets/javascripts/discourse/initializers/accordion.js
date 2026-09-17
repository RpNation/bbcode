import { withPluginApi } from "discourse/lib/plugin-api";
import { createDisclosureDecorator } from "../lib/bbcode-disclosures";

export const addAccordionCode = createDisclosureDecorator({
  selector: ".bb-accordion details.bb-slide",
  groupSelector: ".bb-accordion",
  duration: 400,
  easing: "linear",
});

export default {
  name: "bbcode-accordion",
  initialize() {
    withPluginApi((api) => {
      if (api.container.lookup("service:site-settings").bbcode_enabled) {
        api.decorateCookedElement(addAccordionCode);
      }
    });
  },
};
