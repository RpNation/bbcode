/**
 * @file Initializes any inline spoiler tag with proper js/event handling
 */
import { withPluginApi } from "discourse/lib/plugin-api";

/**
 * Adds the inline js for inline spoilers inside a given post
 * @param {HTMLElement} post the post itself
 */
function addInlineSpoilerCode(post) {
  post.querySelectorAll(".bb-inline-spoiler").forEach((el) => {
    el.addEventListener("click", toggleInlineSpoiler);
  });
}

function toggleInlineSpoiler(event) {
  const inlinespoiler = event.target;
  if (inlinespoiler.attributes.getNamedItem("data-displayed") === null) {
    inlinespoiler.setAttribute("data-displayed", true);
  } else {
    inlinespoiler.removeAttribute("data-displayed");
  }
}

/**
 * The initial called function.
 * Any calls to the PluginAPI should be done in here
 * @param api
 */
function initializeSpoiler(api) {
  api.decorateCookedElement(addInlineSpoilerCode, {
    id: "add inline spoilers",
  });
}

export default {
  name: "inlinespoiler",
  initialize() {
    withPluginApi("0.11.1", initializeSpoiler);
  },
};
