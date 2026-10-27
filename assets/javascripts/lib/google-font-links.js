import discourseLater from "discourse/lib/later";

const GOOGLE_FONTS_ORIGIN = "https://fonts.googleapis.com";
const GOOGLE_FONTS_PATH = "/css2";
const LINK_ATTRIBUTE = "data-rendered-gfont";

// a re-rendered post releases its fonts before it claims them again, and removing
// the stylesheet in between would flash the text in the fallback font
const REMOVE_DELAY_MS = 250;

// stylesheet link => number of posts using it
const references = new WeakMap();

/**
 * @param {string|null} value a `data-font` attribute value
 * @returns {string|null} the normalized stylesheet url, or null unless it points at the Google Fonts css2 api
 */
export function googleFontUrl(value) {
  try {
    const url = new URL(value);
    if (
      url.origin === GOOGLE_FONTS_ORIGIN &&
      url.pathname === GOOGLE_FONTS_PATH
    ) {
      return url.href;
    }
  } catch {
    // not an absolute url
  }
  return null;
}

function findLink(doc, href) {
  return [...doc.head.querySelectorAll(`link[${LINK_ATTRIBUTE}]`)].find(
    (link) => link.getAttribute(LINK_ATTRIBUTE) === href
  );
}

function claim(doc, href) {
  let link = findLink(doc, href);
  if (!link) {
    link = doc.createElement("link");
    link.setAttribute("rel", "stylesheet");
    link.setAttribute("href", href);
    link.setAttribute(LINK_ATTRIBUTE, href);
    doc.head.appendChild(link);
  }
  references.set(link, (references.get(link) ?? 0) + 1);
  return link;
}

function release(link) {
  const remaining = references.get(link) - 1;
  references.set(link, remaining);
  if (remaining > 0) {
    return;
  }

  discourseLater(() => {
    if (references.get(link) === 0) {
      link.remove();
    }
  }, REMOVE_DELAY_MS);
}

/**
 * Adds a stylesheet link to the document head for each font a post uses, sharing links between posts.
 * @param {HTMLElement} post the cooked post
 * @param {Document} [doc] the document to add links to
 * @returns {Function} releases the post's fonts; a link is removed once no post uses it
 */
export function addGoogleFontLinks(post, doc = document) {
  const links = new Map();

  post.querySelectorAll("[data-font]").forEach((element) => {
    const href = googleFontUrl(element.getAttribute("data-font"));
    if (href && !links.has(href)) {
      links.set(href, claim(doc, href));
    }
  });

  let released = false;
  return () => {
    if (!released) {
      released = true;
      links.forEach(release);
    }
  };
}
