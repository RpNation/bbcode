import { cancel, schedule } from "@ember/runloop";

const positionedScrollers = new WeakMap();
const pendingDecorations = new WeakMap();
const scrollableOverflow = new Set(["auto", "scroll"]);

export function decorateBBCodeScrollers(post) {
  pendingDecorations.get(post)?.();
  if (post.isConnected) {
    containBBCodeScrollers(post);
    return;
  }

  // Discourse decorates an inert document before adopting its content into
  // the page. Wait for insertion before reading author CSS or layout styles.
  let timer;
  const cleanup = () => {
    cancel(timer);
    if (pendingDecorations.get(post) === cleanup) {
      pendingDecorations.delete(post);
    }
  };
  pendingDecorations.set(post, cleanup);
  timer = schedule("afterRender", () => {
    pendingDecorations.delete(post);
    containBBCodeScrollers(post);
  });
  return cleanup;
}

// Absolutely positioned artwork must belong to its author's scroll container,
// otherwise it can escape that container and widen the entire topic page.
export function containBBCodeScrollers(post) {
  const view = post.ownerDocument.defaultView;
  if (!post.isConnected || !view) {
    return;
  }

  post.querySelectorAll('div[data-bbcode-div="true"]').forEach((element) => {
    const previous = positionedScrollers.get(element);
    if (
      previous &&
      element.style.position === "relative" &&
      !element.style.getPropertyPriority("position")
    ) {
      // Re-evaluate after class styles change during preview decoration.
      // Restore only our own override, never a new author-supplied position.
      if (previous.value) {
        element.style.setProperty("position", previous.value, previous.priority);
      } else {
        element.style.removeProperty("position");
      }
    }
    positionedScrollers.delete(element);

    const computed = view.getComputedStyle(element);
    if (computed.position !== "static" || !scrollableOverflow.has(computed.overflowX)) {
      return;
    }

    positionedScrollers.set(element, {
      value: element.style.getPropertyValue("position"),
      priority: element.style.getPropertyPriority("position"),
    });
    element.style.setProperty("position", "relative");
  });
}
