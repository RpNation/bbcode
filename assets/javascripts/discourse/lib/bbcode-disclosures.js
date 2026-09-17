const interactiveElements = "a, button, input, select, textarea, [contenteditable='true']";

function disclosure(details, { duration, easing }, onOpen) {
  const summary = details.querySelector(":scope > summary");
  if (!summary) {
    return;
  }

  let animation;
  let targetOpen = details.open;
  let savedStyles;

  const restoreStyles = () => {
    if (!savedStyles) {
      return;
    }
    for (const [property, value, priority] of savedStyles) {
      if (value) {
        details.style.setProperty(property, value, priority);
      } else {
        details.style.removeProperty(property);
      }
    }
    savedStyles = undefined;
  };

  const cancelAnimation = () => {
    if (animation) {
      animation.onfinish = null;
      animation.cancel();
      animation = undefined;
    }
    restoreStyles();
  };

  const setOpen = (open) => {
    if (targetOpen === open && (animation || details.open === open)) {
      return;
    }

    const startHeight = details.getBoundingClientRect().height;
    cancelAnimation();
    targetOpen = open;
    details.open = open;
    if (open) {
      onOpen();
    }

    if (!details.animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const endHeight = details.getBoundingClientRect().height;
    // Keep the content visible until the closing animation finishes.
    details.open = true;
    savedStyles = ["height", "overflow"].map((property) => [
      property,
      details.style.getPropertyValue(property),
      details.style.getPropertyPriority(property),
    ]);
    details.style.height = `${startHeight}px`;
    details.style.overflow = "hidden";
    animation = details.animate(
      { height: [`${startHeight}px`, `${endHeight}px`] },
      { duration, easing }
    );
    animation.onfinish = () => {
      if (details.open) {
        details.open = targetOpen;
      }
      cancelAnimation();
    };
  };

  const onClick = (event) => {
    if (
      event.defaultPrevented ||
      event.target.closest("summary") !== summary ||
      event.target.closest(interactiveElements)
    ) {
      return;
    }
    // Enter and Space on a native summary also produce this click event.
    event.preventDefault();
    setOpen(!(animation ? targetOpen : details.open));
  };

  const onToggle = () => {
    if (animation && !details.open) {
      // Respect a script or browser closing the details during an animation.
      cancelAnimation();
    }
    if (!animation) {
      targetOpen = details.open;
    }
    if (details.open && targetOpen) {
      onOpen();
    }
  };

  summary.addEventListener("click", onClick);
  details.addEventListener("toggle", onToggle);

  return {
    details,
    setOpen,
    cleanup() {
      summary.removeEventListener("click", onClick);
      details.removeEventListener("toggle", onToggle);
      if (animation && details.open) {
        details.open = targetOpen;
      }
      cancelAnimation();
    },
  };
}

export function createDisclosureDecorator(options) {
  // Stream posts run returned cleanup; composer previews can redecorate the same
  // root without doing so. Dispose its previous listeners and animations first.
  const decoratedPosts = new WeakMap();

  return (post) => {
    decoratedPosts.get(post)?.();
    const disclosures = [];
    post.querySelectorAll(options.selector).forEach((details) => {
      const group = options.groupSelector && details.closest(options.groupSelector);
      const controller = disclosure(details, options, () => {
        if (group) {
          for (const other of disclosures) {
            if (
              other.details !== details &&
              other.details.closest(options.groupSelector) === group
            ) {
              other.setOpen(false);
            }
          }
        }
      });
      if (controller) {
        disclosures.push(controller);
      }
    });

    let disposed = false;
    const cleanup = () => {
      if (disposed) {
        return;
      }
      disposed = true;
      disclosures.forEach((controller) => controller.cleanup());
      if (decoratedPosts.get(post) === cleanup) {
        decoratedPosts.delete(post);
      }
    };
    decoratedPosts.set(post, cleanup);
    return cleanup;
  };
}
