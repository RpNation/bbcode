/**
 * @file Find and adds google fonts to the site when the font bbcode is found with the data-font attribute
 */
import { apiInitializer } from "discourse/lib/api";

/**
 * Adds relevant font links inside a given post
 * @param {HTMLElement} post the post itself
 */
function addGoogleFont(post) {
  // Cleans up post if we're editing
  const priorLinks = post.querySelectorAll("link[data-rendered-gfont]");
  priorLinks.forEach((oldLink) => post.removeChild(oldLink));

  const elements = post.querySelectorAll("[data-font]");
  if (!elements.length) {
    return;
  }
  let frag = document.createDocumentFragment();
  const gFonts = [];
  Array.from(elements).map((e) => {
    const data = e.getAttribute("data-font");
    if (!gFonts.includes(data) && isGoogleFontsUrl(data)) {
      frag.appendChild(linkBuilder(data));
      gFonts.push(data);
    }
  });

  post.appendChild(frag);
}

/**
 * data-font can be written as raw HTML, so only Google's host is trusted
 * @param {string} url
 * @returns {boolean}
 */
function isGoogleFontsUrl(url) {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" && parsed.hostname === "fonts.googleapis.com"
    );
  } catch {
    return false;
  }
}

/**
 * builds link tag for google api
 * @param data input for api link
 */
function linkBuilder(data) {
  let link = document.createElement("link");
  link.setAttribute("rel", "stylesheet");
  // link.setAttribute("type", "text/css");
  link.setAttribute("href", data);
  link.setAttribute("data-rendered-gfont", data);
  return link;
}

export default apiInitializer((api) => {
  api.decorateCookedElement((elem) => addGoogleFont(elem), {
    id: "add google font",
  });
});
