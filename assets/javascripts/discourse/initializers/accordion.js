/**
 * @file Initializes any accordion tag with proper js/event handling
 */
import { withPluginApi } from "discourse/lib/plugin-api";

/**
 * Adds the inline js for accordion inside a given post
 * @param {HTMLElement} post the post itself
 */
function addAccordionCode(post) {
  post.querySelectorAll("div.bb-accordion").forEach((el) => {
    // eslint-disable-next-line no-new
    new Accordion(el);
  });
}

/**
 * @typedef Slide
 * @type {object}
 * @property {HTMLDetailsElement} details
 * @property {HTMLElement} summary
 * @property {HTMLElement} content
 * @property {Animation | null} animation
 * @property {boolean} isClosing
 * @property {boolean} isExpanding
 */

class Accordion {
  /** @type {Element} */
  accordion;
  /** @type {Slide[]} */
  slides = [];

  /**
   * Constructs the WAAPI powered accordion
   * @param {Element} el
   */
  constructor(el) {
    this.accordion = el;
    const details = this.accordion.querySelectorAll("details.bb-slide");
    details.forEach((detail) => {
      /** @type {Slide} */
      const slide = {
        details: detail,
        summary: detail.querySelector("summary.bb-slide-title"),
        content: detail.querySelector(".bb-slide-content"),
        animation: null, // Store the animation object (so we can cancel it if needed)
        isClosing: false,
        isExpanding: false,
      };
      slide.summary?.addEventListener("click", (ev) => this.onClick(ev, slide));
      this.slides.push(slide);
    });
  }

  /**
   * @param {MouseEvent} ev
   * @param {Slide} slide
   */
  onClick(ev, slide) {
    // Stop default behaviour from the browser
    ev.preventDefault();
    // Add an overflow on the <details> to avoid content overflowing
    slide.details.style.overflow = "hidden";
    // Check if the element is being closed or is already closed
    if (slide.isClosing || !slide.details.open) {
      this.open(slide);
      // Check if the element is being openned or is already open
    } else if (slide.isExpanding || slide.details.open) {
      this.shrink(slide);
    }
  }

  /**
   * @param {Slide} slide
   */
  shrink(slide) {
    // Set the element as "being closed"
    slide.isClosing = true;
    slide.details.style.overflow = "hidden";

    // Store the current height of the element
    const startHeight = `${slide.details.offsetHeight}px`;
    // Calculate the height of the summary
    const endHeight = `${slide.summary.offsetHeight}px`;

    // If there is already an animation running
    if (slide.animation) {
      // Cancel the current animation
      slide.animation.cancel();
    }

    // Start a WAAPI animation
    slide.animation = slide.details.animate(
      {
        // Set the keyframes from the startHeight to endHeight
        height: [startHeight, endHeight],
      },
      {
        duration: 400,
        easing: "linear",
      }
    );

    // When the animation is complete, call onAnimationFinish()
    slide.animation.onfinish = () => this.onAnimationFinish(false, slide);
    // If the animation is cancelled, isClosing variable is set to false
    slide.animation.oncancel = () => (slide.isClosing = false);
  }

  /**
   * @param {Slide} slide
   */
  open(slide) {
    // Apply a fixed height on the element
    slide.details.style.height = `${slide.details.offsetHeight}px`;
    // Force the [open] attribute on the details element
    slide.details.open = true;
    // Wait for the next frame to call the expand function
    const otherSlides = this.slides.filter((x) => x !== slide);
    for (const otherSlide of otherSlides) {
      this.shrink(otherSlide);
    }
    window.requestAnimationFrame(() => this.expand(slide));
  }
  /**
   * @param {Slide} slide
   */
  expand(slide) {
    // Set the element as "being expanding"
    slide.isExpanding = true;
    // Get the current fixed height of the element
    const startHeight = `${slide.details.offsetHeight}px`;
    // Calculate the open height of the element (summary height + content height)
    const endHeight = `${slide.summary.offsetHeight + slide.content.offsetHeight}px`;

    // If there is already an animation running
    if (slide.animation) {
      // Cancel the current animation
      slide.animation.cancel();
    }

    // Start a WAAPI animation
    slide.animation = slide.details.animate(
      {
        // Set the keyframes from the startHeight to endHeight
        height: [startHeight, endHeight],
      },
      {
        duration: 400,
        easing: "linear",
      }
    );
    // When the animation is complete, call onAnimationFinish()
    slide.animation.onfinish = () => this.onAnimationFinish(true, slide);
    // If the animation is cancelled, isExpanding variable is set to false
    slide.animation.oncancel = () => (slide.isExpanding = false);
  }

  /**
   * @param {boolean} open
   * @param {Slide} slide
   */
  onAnimationFinish(open, slide) {
    // Set the open attribute based on the parameter
    slide.details.open = open;
    // Clear the stored animation
    slide.animation = null;
    // Reset isClosing & isExpanding
    slide.isClosing = false;
    slide.isExpanding = false;
    // Remove the overflow hidden and the fixed height
    slide.details.style.height = slide.details.style.overflow = "";
  }
}

/**
 * The initial called function.
 * Any calls to the PluginAPI should be done in here
 * @param api
 */
function initializeAccordion(api) {
  api.decorateCookedElement(addAccordionCode, { id: "add accordions", afterAdopt: true });
}

export default {
  name: "accordion",
  initialize() {
    withPluginApi("0.11.1", initializeAccordion);
  },
};
