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
  priorLinks.forEach((oldLink) => oldLink.remove());

  const elements = post.querySelectorAll("[data-font]");
  if (!elements.length) {
    return;
  }
  let frag = document.createDocumentFragment();
  const gFonts = [];
  Array.from(elements).map((e) => {
    const data = e.getAttribute("data-font");
    if (
      !gFonts.includes(data) &&
      data.startsWith("https://fonts.googleapis.com/css2?")
    ) {
      frag.appendChild(linkBuilder(data));
      gFonts.push(data);
    }
  });

  post.appendChild(frag);
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
  if (!api.container.lookup("service:site-settings").bbcode_enabled) {
    return;
  }

  api.decorateCookedElement((elem) => addGoogleFont(elem), {
    id: "add google font",
  });
});
