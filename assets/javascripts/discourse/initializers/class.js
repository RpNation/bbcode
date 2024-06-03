/**
 * @file Initializes and adds any custom user styles to the post
 */
import { withPluginApi } from "discourse/lib/plugin-api";

/**
 * Adds the inline styles for the style tag inside a given post
 * @param {HTMLElement} post the post itself
 */
function addClassStyleCode(post) {
  // cleans up existing styles
  post.querySelectorAll("style[data-rendered-class]").forEach((el) => {
    post.removeChild(el);
  });

  post.querySelectorAll("template[data-bbcode-plus='class']").forEach((el) => {
    const style = document.createElement("style");
    style.setAttribute("data-rendered-class", "");
    if (window.CSSScopeRule) {
      // extra css encapsulation
      // not particularly necessary since we're already using a unique class name
      // but should help with keeping the CSS namespace clear
      style.appendChild(document.createTextNode("@scope { "));
      style.appendChild(el.content.cloneNode(true));
      style.appendChild(document.createTextNode(" }"));
    } else {
      style.appendChild(el.content.cloneNode(true));
    }
    post.prepend(style);
  });
}

function initializeClassStyle(api) {
  api.decorateCookedElement(addClassStyleCode, { id: "add class style code" });
}

export default {
  name: "class-style",
  initialize() {
    withPluginApi("0.11.1", initializeClassStyle);
  },
};
