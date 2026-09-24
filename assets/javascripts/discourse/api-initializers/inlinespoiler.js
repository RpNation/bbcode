/**
 * @file Initializes any inline spoiler tag with proper js/event handling
 */
import { apiInitializer } from "discourse/lib/api";

/**
 * Adds the inline js for inline spoilers inside a given post
 * @param {HTMLElement} post the post itself
 */
function addInlineSpoilerCode(post) {
  post.querySelectorAll(".bb-inline-spoiler").forEach((el) => {
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    el.setAttribute("aria-expanded", "false");
    el.addEventListener("click", toggleInlineSpoiler);
    el.addEventListener("keydown", onInlineSpoilerKeydown);
  });
}

function toggleInlineSpoiler(event) {
  // currentTarget, since the click can land on formatting inside the spoiler
  const inlinespoiler = event.currentTarget;
  const displayed = !inlinespoiler.hasAttribute("data-displayed");
  if (displayed) {
    inlinespoiler.setAttribute("data-displayed", "true");
  } else {
    inlinespoiler.removeAttribute("data-displayed");
  }
  inlinespoiler.setAttribute("aria-expanded", String(displayed));
}

function onInlineSpoilerKeydown(event) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    toggleInlineSpoiler(event);
  }
}

export default apiInitializer((api) => {
  api.decorateCookedElement(addInlineSpoilerCode, {
    id: "add inline spoilers",
  });
});
