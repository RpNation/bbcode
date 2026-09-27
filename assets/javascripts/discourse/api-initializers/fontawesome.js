import { apiInitializer } from "discourse/lib/api";
import loadscript from "discourse/lib/load-script";

/**
 * Resolves once the kit defines `window.FontAwesome`, which can be after its
 * script finishes loading.
 * @returns {Promise<any>}
 */
function whenFontAwesomeReady() {
  if (window.FontAwesome) {
    return Promise.resolve(window.FontAwesome);
  }
  return new Promise((resolve) => {
    Object.defineProperty(window, "FontAwesome", {
      configurable: true,
      set(val) {
        Object.defineProperty(window, "FontAwesome", {
          value: val,
          configurable: true,
          enumerable: true,
          writable: true,
        });
        resolve(val);
      },
    });
  });
}

export default apiInitializer((api) => {
  const siteSettings = api.container.lookup("service:site-settings");
  if (!siteSettings.fontawesome_kit_url) {
    return;
  }
  window.FontAwesomeConfig = {
    autoReplaceSvg: false,
    observeMutations: false,
    keepOriginalSource: false,
  };
  // settles with null if the kit fails, so waiting posts are released
  const fontAwesome = Promise.race([
    whenFontAwesomeReady(),
    loadscript(siteSettings.fontawesome_kit_url).then(
      () => new Promise(() => {}),
      (err) => {
        // eslint-disable-next-line no-console
        console.error("Failed to load Font Awesome Kit", err);
        return null;
      }
    ),
  ]);

  // registered up front so posts rendered before the kit loads are decorated too
  api.decorateCookedElement(
    /**
     * Font Awesome config does not provide a way to allowlist nodes, so the
     * post's icons are converted one by one.
     * @param {HTMLElement} post
     */
    (post) => {
      const icons = post.querySelectorAll("i[data-bbcode-fa]");
      if (!icons.length) {
        return;
      }
      fontAwesome.then((fa) => {
        if (fa && post.isConnected) {
          icons.forEach((icon) => fa.dom.i2svg({ node: icon }));
        }
      });
    },
    { id: "add fontawesome" }
  );
});
