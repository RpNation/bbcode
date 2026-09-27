import { module, test } from "qunit";
import { addInlineSpoilerCode } from "discourse/plugins/bbcode/discourse/api-initializers/inlinespoiler";

module("Unit | Lib | bbcode inline spoiler", function () {
  function press(element, key) {
    const event = new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
    });
    element.dispatchEvent(event);
    return event;
  }

  function spoilerWithLink() {
    const post = document.createElement("div");
    post.innerHTML = `<span class="bb-inline-spoiler"><a href="#target">open link</a></span>`;
    addInlineSpoilerCode(post);
    return post;
  }

  test("Enter on the spoiler toggles it", function (assert) {
    const spoiler = spoilerWithLink().querySelector(".bb-inline-spoiler");

    const event = press(spoiler, "Enter");

    assert.true(event.defaultPrevented);
    assert.strictEqual(spoiler.getAttribute("aria-expanded"), "true");
  });

  test("Enter on a link inside the spoiler follows the link", function (assert) {
    const post = spoilerWithLink();
    const spoiler = post.querySelector(".bb-inline-spoiler");
    press(spoiler, "Enter");

    const event = press(post.querySelector("a"), "Enter");

    assert.false(event.defaultPrevented, "the link's default isn't prevented");
    assert.strictEqual(
      spoiler.getAttribute("aria-expanded"),
      "true",
      "the spoiler stays open"
    );
  });
});
