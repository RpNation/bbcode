import loadscript from "discourse/lib/load-script";
import { withPluginApi } from "discourse/lib/plugin-api";
/* global bbscriptParser */

const decoratedPosts = new WeakMap();
let parserPromise;

function decorateBBScript(post) {
  decoratedPosts.get(post)?.();
  const templates = [...post.querySelectorAll("template[data-bbcode-plus='script']")];
  if (!templates.length) {
    return;
  }

  let disposed = false;
  let observer;
  const events = new AbortController();
  const cleanup = () => {
    disposed = true;
    observer?.disconnect();
    events.abort();
    if (decoratedPosts.get(post) === cleanup) {
      decoratedPosts.delete(post);
    }
  };
  decoratedPosts.set(post, cleanup);

  parserPromise ||= loadscript("/plugins/bbcode/javascripts/bbscript-parser.min.js");
  parserPromise
    .then(() => {
      if (disposed) {
        return;
      }

      const isPreview = !!post.closest(".d-editor-preview");
      if (isPreview) {
        delete bbscriptParser.bbscriptData.preview;
      }
      const initializers = [];
      for (const el of templates) {
        const callerId = el.getAttribute("data-bbscript-id") || "";
        const callerClass = el.getAttribute("data-bbscript-class") || "";
        const content = el.content.textContent || "";
        const on = el.getAttribute("data-bbscript-on") || "init";
        let version = el.getAttribute("data-bbscript-ver") || "";
        if (!version) {
          version = content.split("\n").some((line) => line.trim().startsWith("(")) ? "2" : "1";
        }
        let astTree;
        if (version === "2") {
          const parsed = bbscriptParser.bbscript2Parser.parse(content);
          astTree = parsed.ast;
          if (parsed.formattedErrors.length) {
            // eslint-disable-next-line no-console
            console.warn(parsed.formattedErrors);
          }
        } else {
          astTree = bbscriptParser.bbscriptProcessorV1.parse(content);
        }

        const selector = callerClass && `.${CSS.escape(callerClass + "__" + callerId)}`;
        if (on === "init") {
          initializers.push(() => {
            const target = selector ? post.querySelectorAll(selector) : undefined;
            triggerBBScript(callerId, callerClass, astTree, version, target);
          });
        } else if (selector) {
          post.addEventListener(
            on,
            (event) => {
              const target = event.target?.closest?.(selector);
              if (target && post.contains(target)) {
                triggerBBScript(callerId, callerClass, astTree, version, target);
              }
            },
            { capture: true, signal: events.signal }
          );
        }
      }

      if (!initializers.length) {
        return;
      }
      if (isPreview) {
        initializers.forEach((initialize) => initialize());
      } else {
        observer = new IntersectionObserver(
          (entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
              observer.disconnect();
              initializers.forEach((initialize) => initialize());
            }
          },
          { rootMargin: "10px 0px 0px 0px" }
        );
        observer.observe(post);
      }
    })
    .catch((error) => {
      cleanup();
      // eslint-disable-next-line no-console
      console.warn("Could not initialize BBScript", error);
    });

  return cleanup;
}

/**
 * @param {string} callerId
 * @param {string} callerClass
 * @param {ASTNode[] | astNode[]} astTree
 * @param {string} version
 * @param {Element | NodeListOf<Element>} [target]
 * @returns {void}
 */
const triggerBBScript = (callerId, callerClass, astTree, version, target) => {
  if (version === "1") {
    bbscriptParser.bbscriptProcessorV1.execAll(astTree, callerId, callerClass, { target });
  } else if (version === "2") {
    try {
      bbscriptParser.bbscriptProcessorV2.execAll(astTree, callerId, callerClass, { target });
    } catch (e) {
      if (e?.message !== "BBScript Stop Command") {
        // eslint-disable-next-line no-console
        console.warn(e);
      }
    }
  }
};

function initializeBBScript(api) {
  const siteSettings = api.container.lookup("service:site-settings");
  if (siteSettings.bbcode_enabled && siteSettings.enable_bbscript) {
    api.decorateCookedElement(decorateBBScript);
  }
}

export default {
  name: "bbscript",
  initialize() {
    withPluginApi(initializeBBScript);
  },
};
