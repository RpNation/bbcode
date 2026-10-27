/**
 * @file Loads the google fonts referenced by the data-font attribute that the font bbcode adds
 */
import { apiInitializer } from "discourse/lib/api";
import { addGoogleFontLinks } from "discourse/plugins/bbcode/lib/google-font-links";

export default apiInitializer((api) => {
  api.decorateCookedElement((elem) => addGoogleFontLinks(elem), {
    id: "add google font",
  });
});
