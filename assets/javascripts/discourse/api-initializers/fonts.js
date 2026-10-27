/**
 * @file Loads the fonts referenced by the data-font attribute that the font bbcode adds
 */
import { apiInitializer } from "discourse/lib/api";
import { addFontLinks } from "discourse/plugins/bbcode/lib/font-links";

export default apiInitializer((api) => {
  const siteSettings = api.container.lookup("service:site-settings");

  api.decorateCookedElement(
    (elem) =>
      addFontLinks(elem, { selfHosted: siteSettings.bbcode_self_host_fonts }),
    { id: "add fonts" }
  );
});
