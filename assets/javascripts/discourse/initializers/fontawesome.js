import loadscript from "discourse/lib/load-script";
import { withPluginApi } from "discourse/lib/plugin-api";

const postsMissingFontAwesome = [];

function initializeFontAwesome(api) {
  const siteSettings = api.container.lookup("service:site-settings");
  if (!siteSettings.fontawesome_kit_url) {
    return;
  }
  window.FontAwesomeConfig = {
    autoReplaceSvg: false,
    observeMutations: false,
    keepOriginalSource: false,
  };
  loadscript(siteSettings.fontawesome_kit_url)
    .then(() => {
      api.decorateCookedElement(
        /**
         * Manually detects and identifies Font Awesome icons in a given post to be appended.
         *
         * Font Awesome config does not provide a way to whitelist nodes.
         * @param {HTMLElement} post
         */
        (post) => {
          if (window.FontAwesome) {
            post.querySelectorAll("i[data-bbcode-fa]").forEach((icon) => {
              window.FontAwesome.dom.i2svg({ node: icon });
            });
          } else {
            postsMissingFontAwesome.push(post);
            // if FontAwesome hasn't loaded yet, wait for it to load (ie page refresh)
            Object.defineProperty(window, "FontAwesome", {
              configurable: true,
              set(val) {
                Object.defineProperty(window, "FontAwesome", {
                  value: val,
                  configurable: true,
                  enumerable: true,
                  writable: true,
                });
                postsMissingFontAwesome.forEach((p) => {
                  p.querySelectorAll("i[data-bbcode-fa]").forEach((icon) => {
                    window.FontAwesome.dom.i2svg({ node: icon });
                  });
                });
                postsMissingFontAwesome.length = 0;
              },
            });
          }
        },
        {
          id: "add fontawesome",
          afterAdopt: true,
        }
      );
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error("Failed to load Font Awesome Kit", err);
    });
}

export default {
  name: "bbcode-fontawesome-init",
  initialize() {
    withPluginApi("0.11.1", initializeFontAwesome);
  },
};
