import { module, test } from "qunit";
import { addInlineSpoilerCode } from "discourse/plugins/bbcode/discourse/initializers/inlinespoiler";

module("BBCode | Unit | Inline spoiler", function (hooks) {
  hooks.beforeEach(function () {
    this.post = document.createElement("div");
    this.post.innerHTML = '<span class="bb-inline-spoiler"><strong>Hidden text</strong></span>';
    document.getElementById("qunit-fixture").append(this.post);
    this.spoiler = this.post.querySelector(".bb-inline-spoiler");
  });

  test("clicking formatted text toggles the entire spoiler", function (assert) {
    addInlineSpoilerCode(this.post);
    const child = this.spoiler.querySelector("strong");

    child.click();
    assert.dom(this.spoiler).hasAttribute("data-displayed", "true");
    assert.dom(this.spoiler).hasAttribute("aria-expanded", "true");
    assert.dom(child).doesNotHaveAttribute("data-displayed");

    child.click();
    assert.dom(this.spoiler).doesNotHaveAttribute("data-displayed");
    assert.dom(this.spoiler).hasAttribute("aria-expanded", "false");
  });

  test("redecorating a preview does not add duplicate click handlers", function (assert) {
    addInlineSpoilerCode(this.post);
    addInlineSpoilerCode(this.post);
    addInlineSpoilerCode(this.post);

    this.spoiler.click();
    assert.dom(this.spoiler).hasAttribute("data-displayed", "true");

    this.spoiler.click();
    assert.dom(this.spoiler).doesNotHaveAttribute("data-displayed");
  });

  test("supports keyboard activation without swallowing unrelated keys", function (assert) {
    addInlineSpoilerCode(this.post);
    assert.dom(this.spoiler).hasAttribute("tabindex", "0");
    assert.dom(this.spoiler).hasAttribute("role", "button");
    assert.dom(this.spoiler).hasAttribute("aria-expanded", "false");

    const enter = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    this.spoiler.dispatchEvent(enter);
    assert.true(enter.defaultPrevented);
    assert.dom(this.spoiler).hasAttribute("data-displayed", "true");

    const arrow = new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      cancelable: true,
    });
    this.spoiler.dispatchEvent(arrow);
    assert.false(arrow.defaultPrevented);
    assert.dom(this.spoiler).hasAttribute("data-displayed", "true");

    const space = new KeyboardEvent("keydown", {
      key: " ",
      bubbles: true,
      cancelable: true,
    });
    this.spoiler.dispatchEvent(space);
    assert.true(space.defaultPrevented);
    assert.dom(this.spoiler).doesNotHaveAttribute("data-displayed");
    assert.dom(this.spoiler).hasAttribute("aria-expanded", "false");
  });

  test("nested spoilers do not toggle their parent", function (assert) {
    this.spoiler.innerHTML = 'Outer <span class="bb-inline-spoiler"><strong>Inner</strong></span>';
    const inner = this.spoiler.querySelector(".bb-inline-spoiler");
    addInlineSpoilerCode(this.post);

    this.spoiler.click();
    inner.querySelector("strong").click();
    assert.dom(this.spoiler).hasAttribute("data-displayed", "true");
    assert.dom(inner).hasAttribute("data-displayed", "true");

    inner.click();
    assert.dom(this.spoiler).hasAttribute("data-displayed", "true");
    assert.dom(inner).doesNotHaveAttribute("data-displayed");
  });

  test("new preview nodes are decorated without resetting existing state", function (assert) {
    addInlineSpoilerCode(this.post);
    this.spoiler.click();
    this.post.insertAdjacentHTML("beforeend", '<span class="bb-inline-spoiler">New content</span>');
    addInlineSpoilerCode(this.post);

    const added = this.post.lastElementChild;
    assert.dom(this.spoiler).hasAttribute("aria-expanded", "true");
    assert.dom(added).hasAttribute("aria-expanded", "false");
    added.click();
    assert.dom(added).hasAttribute("data-displayed", "true");
    assert.dom(this.spoiler).hasAttribute("data-displayed", "true");
  });

  test("revealed links reach delegated handlers through nested spoilers", function (assert) {
    this.spoiler.innerHTML =
      'Outer <span class="bb-inline-spoiler"><a class="mention" href="/u/alice">@alice</a></span>';
    const inner = this.spoiler.querySelector(".bb-inline-spoiler");
    const link = inner.querySelector("a");
    let delegatedClicks = 0;
    this.post.addEventListener("click", (event) => {
      delegatedClicks++;
      assert.strictEqual(event.target, link);
      assert.false(event.defaultPrevented, "the spoiler preserves native link handling");
      // Stand in for Discourse's user-card handler and avoid navigating the test.
      event.preventDefault();
    });
    addInlineSpoilerCode(this.post);

    this.spoiler.click();
    link.click();
    assert.strictEqual(delegatedClicks, 0, "the first click only reveals hidden content");
    assert.dom(inner).hasAttribute("data-displayed", "true");

    link.click();
    assert.strictEqual(delegatedClicks, 1, "the revealed link reaches the post handler");
    assert.dom(inner).hasAttribute("data-displayed", "true");
    assert.dom(this.spoiler).hasAttribute("data-displayed", "true");
  });
});
