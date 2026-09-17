import { withPluginApi } from "discourse/lib/plugin-api";

const decoratedSlides = new WeakSet();

// Native details elements handle focus, keyboard input and disclosure state.
// Only the accordion's exclusive-open behavior needs a decorator.
export function addAccordionCode(post) {
  post.querySelectorAll("details.bb-slide").forEach((slide) => {
    if (decoratedSlides.has(slide)) {
      return;
    }

    const accordion = slide.closest(".bb-accordion");
    if (!accordion) {
      return;
    }

    decoratedSlides.add(slide);
    slide.addEventListener("toggle", () => {
      if (!slide.open) {
        return;
      }

      accordion.querySelectorAll("details.bb-slide[open]").forEach((other) => {
        if (other !== slide && other.closest(".bb-accordion") === accordion) {
          other.open = false;
        }
      });
    });
  });
}

export default {
  name: "bbcode-accordion",
  initialize() {
    withPluginApi((api) => {
      if (!api.container.lookup("service:site-settings").bbcode_enabled) {
        return;
      }

      api.decorateCookedElement(addAccordionCode);
    });
  },
};
