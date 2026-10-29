import { getURLWithCDN } from "discourse/lib/get-url";
import discourseLater from "discourse/lib/later";
import { slugify } from "discourse/lib/utilities";

const GOOGLE_FONTS_URL = "https://fonts.googleapis.com/css2";
const LINK_ATTRIBUTE = "data-rendered-font";

// a re-rendered post releases its fonts before it claims them again, and removing
// the stylesheet in between would flash the text in the fallback font
const REMOVE_DELAY_MS = 250;

// stylesheet link => number of posts using it
const references = new WeakMap();

// the same shape the font bbcode accepts, since a family comes from user content
const FAMILY_FORMAT = /^[A-Za-z0-9][A-Za-z0-9 ]{0,63}$/;
const VARIATION_SETTING = /["']([A-Za-z]{4})["']\s+(-?[\d.]+)/g;

// What Google needs to serve the face the font bbcode put on the span.
function googleUrlFor(family, style) {
  const axes = {
    ital: style.fontStyle === "italic" ? 1 : 0,
    wght: parseInt(style.fontWeight, 10) || 400,
  };
  for (const [, tag, value] of (style.fontVariationSettings ?? "").matchAll(
    VARIATION_SETTING
  )) {
    axes[tag] = value;
  }

  // google fonts requires axes names to be in alphabetical order
  const tags = Object.keys(axes).sort();
  const values = tags.map((tag) => axes[tag]);
  return `${GOOGLE_FONTS_URL}?family=${family.replaceAll(" ", "+")}:${tags.join(",")}@${values.join(",")}`;
}

function stylesheetUrl(element, selfHosted) {
  const family = element.getAttribute("data-font");
  if (!FAMILY_FORMAT.test(family)) {
    return null;
  }

  if (selfHosted) {
    return getURLWithCDN(`/bbcode/fonts/${slugify(family)}.css`);
  }
  return googleUrlFor(family, element.style);
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
 * @param {Object} [options]
 * @param {boolean} [options.selfHosted] load the fonts from this site instead of from Google
 * @param {Document} [options.doc] the document to add links to
 * @returns {Function} releases the post's fonts; a link is removed once no post uses it
 */
export function addFontLinks(
  post,
  { selfHosted = false, doc = document } = {}
) {
  const links = new Map();

  post.querySelectorAll("[data-font]").forEach((element) => {
    const href = stylesheetUrl(element, selfHosted);
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
