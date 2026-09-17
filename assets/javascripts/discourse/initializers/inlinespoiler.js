import { withPluginApi } from "discourse/lib/plugin-api";

// Preview decoration can run repeatedly on surviving nodes. Bind each once;
// a WeakSet releases removed nodes without a separate global listener list.
const decoratedSpoilers = new WeakSet();

function toggleInlineSpoiler(event) {
  if (event.type === "keydown" && !["Enter", " "].includes(event.key)) {
    return;
  }

  const spoiler = event.currentTarget;
  if (
    event.target !== spoiler &&
    spoiler.getAttribute("data-displayed") === "true" &&
    event.target.closest("a, button, input, select, textarea")
  ) {
    // Let revealed links and controls reach Discourse's delegated handlers.
    // Enclosing revealed spoilers also take this branch without toggling.
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  const displayed = spoiler.getAttribute("data-displayed") !== "true";
  if (displayed) {
    spoiler.setAttribute("data-displayed", "true");
  } else {
    spoiler.removeAttribute("data-displayed");
  }
  spoiler.setAttribute("aria-expanded", String(displayed));
}

export function addInlineSpoilerCode(post) {
  post.querySelectorAll(".bb-inline-spoiler").forEach((spoiler) => {
    if (decoratedSpoilers.has(spoiler)) {
      return;
    }

    decoratedSpoilers.add(spoiler);
    spoiler.setAttribute("tabindex", "0");
    spoiler.setAttribute("role", "button");
    spoiler.setAttribute(
      "aria-expanded",
      String(spoiler.getAttribute("data-displayed") === "true")
    );
    spoiler.addEventListener("click", toggleInlineSpoiler);
    spoiler.addEventListener("keydown", toggleInlineSpoiler);
  });
}

export default {
  name: "bbcode-inline-spoiler",
  initialize() {
    withPluginApi((api) => {
      if (!api.container.lookup("service:site-settings").bbcode_enabled) {
        return;
      }

      api.decorateCookedElement(addInlineSpoilerCode);
    });
  },
};
