/**
 * @file Resolves upload:// references left behind in bbcode-generated CSS by
 * client-side cooking (e.g. the composer preview): the server resolves these
 * at cook time, but the preview's markdown-it engine has no upload lookup, so
 * it cooks the literal upload:// text through unresolved.
 */
import {
  lookupCachedUploadUrl,
  lookupUncachedUploadUrls,
  MISSING,
} from "pretty-text/upload-short-url";
import { ajax } from "discourse/lib/ajax";
import discourseDebounce from "discourse/lib/debounce";
import { withPluginApi } from "discourse/lib/plugin-api";

const UPLOAD_URL_REGEX = /url\(\s*(['"]?)(upload:\/\/[^'")]+)\1\s*\)/gi;

let queuedShortUrls;
let queuePromise;
let queueResolve;

function queuePop() {
  lookupUncachedUploadUrls(queuedShortUrls, ajax).then(queueResolve);
  queuedShortUrls = queueResolve = null;
}

// Batches short-url lookups across a debounce window (matching core's own
// composer-preview resolver) so multiple decorated posts on the same page
// share one request instead of firing one each.
function resolveUncachedShortUrls(shortUrls) {
  if (!queuedShortUrls) {
    queuedShortUrls = [...shortUrls];
    queuePromise = new Promise((resolve) => (queueResolve = resolve));
    discourseDebounce(null, queuePop, 450);
  } else {
    queuedShortUrls.push(...shortUrls);
  }
  return queuePromise;
}

function cssOf(node) {
  return node.tagName === "STYLE"
    ? node.textContent
    : node.getAttribute("style");
}

function setCssOf(node, css) {
  if (node.tagName === "STYLE") {
    node.textContent = css;
  } else {
    node.setAttribute("style", css);
  }
}

/**
 * @param {HTMLElement} post the post itself
 */
async function resolveCssUploadUrls(post) {
  const nodes = [
    ...post.querySelectorAll("style[data-rendered-class]"),
    ...post.querySelectorAll("[style*='upload://']"),
  ];

  const shortUrls = new Set();
  nodes.forEach((node) => {
    for (const match of cssOf(node).matchAll(UPLOAD_URL_REGEX)) {
      shortUrls.add(match[2]);
    }
  });

  if (shortUrls.size === 0) {
    return;
  }

  const uncached = [...shortUrls].filter(
    (url) => !lookupCachedUploadUrl(url).url
  );
  if (uncached.length > 0) {
    await resolveUncachedShortUrls(uncached);
  }

  const resolved = new Map();
  shortUrls.forEach((url) => {
    const { url: resolvedUrl } = lookupCachedUploadUrl(url);
    if (resolvedUrl && resolvedUrl !== MISSING) {
      resolved.set(url, resolvedUrl);
    }
  });

  if (resolved.size === 0) {
    return;
  }

  const replaced = (css) =>
    css.replace(UPLOAD_URL_REGEX, (fullMatch, quote, shortUrl) => {
      const url = resolved.get(shortUrl);
      return url ? `url(${quote}${url}${quote})` : fullMatch;
    });

  nodes.forEach((node) => setCssOf(node, replaced(cssOf(node))));
}

export default {
  name: "bbcode-css-upload-urls",
  // must run after class-tag CSS is materialized into a live <style> tag, since
  // this patches that derived node rather than the <template> it comes from
  after: ["inject-objects", "bbcode-class-styles"],
  initialize() {
    withPluginApi((api) => {
      api.decorateCookedElement(resolveCssUploadUrls, {
        id: "resolve bbcode css upload urls",
      });
    });
  },
};
