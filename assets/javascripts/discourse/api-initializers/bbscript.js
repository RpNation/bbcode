import { apiInitializer } from "discourse/lib/api";
import discourseDebounce from "discourse/lib/debounce";
import loadScript from "discourse/lib/load-script";
import {
  CALLER_ID_RE,
  CLASS_NAME_RE,
  scopedClassName,
} from "../../lib/discourse-markdown/bbcode-native/scoping";
/* global bbscriptParser */

const PARSER_URL = "/plugins/bbcode/javascripts/bbscript-parser.min.js";
const PREVIEW_CLASS = "d-editor-preview";
const SCRIPT_SELECTOR = "template[data-bbcode-plus='script']";

/** @type {WeakMap<Element, Function[]>} */
const pendingInits = new WeakMap();
/** @type {WeakMap<Element, Function>} */
const teardowns = new WeakMap();

const visibilityObserver = new IntersectionObserver(
  (entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const post = entry.target;
        pendingInits.get(post)?.forEach((run) => run());
        pendingInits.delete(post);
        observer.unobserve(post);
      }
    });
  },
  {
    threshold: 0,
    rootMargin: "10px 0px 0px 0px",
  }
);

/**
 * @param {string} content
 * @param {string} version
 * @returns {{ astTree: any[], version: string }}
 */
function parseScript(content, version) {
  // bbscript2 is the only version with lines opening a call
  version ||= content.split("\n").some((line) => line.trim().startsWith("("))
    ? "2"
    : "1";
  if (version !== "2") {
    return {
      astTree: bbscriptParser.bbscriptProcessorV1.parse(content),
      version,
    };
  }
  const parsed = bbscriptParser.bbscript2Parser.parse(content);
  if (parsed.formattedErrors.length) {
    // eslint-disable-next-line no-console
    console.warn(parsed.formattedErrors);
  }
  return { astTree: parsed.ast, version };
}

/**
 * Wires up every script in a post, replacing any earlier run on the same
 * element. The post's scripts share one variable store that no other post,
 * or other render of this post, can see.
 * @param {HTMLElement} post
 */
function attachScripts(post) {
  teardowns.get(post)?.();
  const data = bbscriptParser.createStore();
  const timers = new Set();
  const listeners = [];

  post.querySelectorAll(SCRIPT_SELECTOR).forEach((el) => {
    const callerId = el.dataset.bbscriptId || "";
    const callerClass = el.dataset.bbscriptClass || "";
    // posts cooked before class names were validated can still hold anything
    if (
      !CALLER_ID_RE.test(callerId) ||
      (callerClass && !CLASS_NAME_RE.test(callerClass))
    ) {
      return;
    }
    const selector = `.${scopedClassName(callerClass, callerId)}`;
    const on = el.dataset.bbscriptOn || "init";
    const { astTree, version } = parseScript(
      el.content.textContent || "",
      el.dataset.bbscriptVer || ""
    );
    const processor =
      version === "1"
        ? bbscriptParser.bbscriptProcessorV1
        : bbscriptParser.bbscriptProcessorV2;
    const run = (target) => {
      try {
        processor.execAll(astTree, callerId, callerClass, {
          data,
          root: post,
          target,
          timers,
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn(e);
      }
    };

    if (on === "init") {
      if (!pendingInits.has(post)) {
        pendingInits.set(post, []);
      }
      pendingInits
        .get(post)
        .push(() =>
          run(callerClass ? post.querySelectorAll(selector) : undefined)
        );
      visibilityObserver.observe(post);
    } else if (callerClass) {
      const listener = (ev) => {
        // a non-bubbling event reaches this capture listener once per element
        // entered, so only the target itself may run its script
        const target = ev.bubbles
          ? ev.target.closest?.(selector)
          : ev.target.matches?.(selector) && ev.target;
        if (target && post.contains(target)) {
          run(target);
        }
      };
      post.addEventListener(on, listener, true);
      listeners.push([on, listener]);
    }
  });

  teardowns.set(post, () => {
    // timeouts and intervals share one handle pool, so this clears both
    timers.forEach((handle) => clearTimeout(handle));
    timers.clear();
    listeners.forEach(([on, listener]) =>
      post.removeEventListener(on, listener, true)
    );
    pendingInits.delete(post);
    visibilityObserver.unobserve(post);
  });
}

/**
 * The composer drops decorator teardowns. Re-attaching replaces the previous
 * run, and the timers of a preview that has left the page stop themselves.
 * @param {HTMLElement} preview
 */
async function attachPreviewScripts(preview) {
  if (!preview.querySelector(SCRIPT_SELECTOR)) {
    teardowns.get(preview)?.();
    return;
  }
  await loadScript(PARSER_URL);
  if (preview.isConnected) {
    attachScripts(preview);
  }
}

/**
 * @param {HTMLElement} element
 * @returns {Function | undefined} teardown for posts; previews manage their own
 */
function decorateScripts(element) {
  if (element.classList.contains(PREVIEW_CLASS)) {
    // the preview re-renders on every keystroke
    discourseDebounce(element, attachPreviewScripts, element, 1000);
    return;
  }
  if (!element.querySelector(SCRIPT_SELECTOR)) {
    return;
  }

  let destroyed = false;
  loadScript(PARSER_URL).then(() => {
    if (!destroyed) {
      attachScripts(element);
    }
  });
  return () => {
    destroyed = true;
    teardowns.get(element)?.();
  };
}

export default apiInitializer((api) => {
  const siteSettings = api.container.lookup("service:site-settings");
  if (!siteSettings.enable_bbscript) {
    return;
  }

  api.decorateCookedElement(decorateScripts, { id: "add bbscript" });
});
