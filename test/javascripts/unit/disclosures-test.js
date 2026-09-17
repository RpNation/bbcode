import { module, test } from "qunit";
import sinon from "sinon";
import { addAccordionCode } from "discourse/plugins/bbcode/discourse/initializers/accordion";
import { addSpoilerCode } from "discourse/plugins/bbcode/discourse/initializers/spoiler";

module("BBCode | Unit | Animated disclosures", function (hooks) {
  hooks.beforeEach(function () {
    this.post = document.createElement("div");
    document.getElementById("qunit-fixture").append(this.post);
    this.sandbox = sinon.createSandbox();
    this.sandbox.stub(window, "matchMedia").returns({ matches: false });
    this.animations = [];
    const animations = this.animations;
    this.sandbox.stub(Element.prototype, "animate").callsFake(function (frames, options) {
      const animation = { cancel: sinon.spy(), onfinish: null, frames, options, element: this };
      animations.push(animation);
      return animation;
    });
  });

  hooks.afterEach(function () {
    this.cleanup?.();
    this.sandbox.restore();
  });

  test("keeps spoiler open/close animations and restores author styles", function (assert) {
    this.post.innerHTML =
      '<details class="bb-spoiler" style="height:auto;overflow:visible"><summary>Title</summary><div class="bb-spoiler-content">Content</div></details>';
    const details = this.post.firstElementChild;
    this.cleanup = addSpoilerCode(this.post);

    details.firstElementChild.click();
    assert.true(details.open);
    assert.strictEqual(this.animations.length, 1);
    assert.deepEqual(this.animations[0].options, { duration: 200, easing: "ease-in-out" });
    this.animations[0].onfinish();
    assert.strictEqual(details.style.height, "auto");
    assert.strictEqual(details.style.overflow, "visible");

    details.firstElementChild.click();
    assert.true(details.open, "content remains visible during closing");
    this.animations[1].onfinish();
    assert.false(details.open);
    assert.strictEqual(details.style.height, "auto");
  });

  test("reverses an unfinished animation and ignores stale completion", function (assert) {
    this.post.innerHTML =
      '<details class="bb-spoiler"><summary>Title</summary><div>Content</div></details>';
    const details = this.post.firstElementChild;
    this.cleanup = addSpoilerCode(this.post);
    details.firstElementChild.click();
    const opening = this.animations[0];
    details.firstElementChild.click();
    assert.true(opening.cancel.calledOnce);
    assert.strictEqual(opening.onfinish, null);
    this.animations[1].onfinish();
    assert.false(details.open);
    assert.strictEqual(details.style.height, "");
  });

  test("external close cancels an opening animation without reopening the disclosure", function (assert) {
    this.post.innerHTML =
      '<details class="bb-spoiler"><summary>Title</summary><div>Content</div></details>';
    const details = this.post.firstElementChild;
    this.cleanup = addSpoilerCode(this.post);
    details.firstElementChild.click();
    const opening = this.animations[0];

    details.open = false;
    details.dispatchEvent(new Event("toggle"));

    assert.true(opening.cancel.calledOnce);
    assert.strictEqual(opening.onfinish, null);
    assert.false(details.open);
    assert.strictEqual(details.style.height, "");
    this.cleanup();
    assert.false(details.open);

    this.cleanup = addSpoilerCode(this.post);
    details.firstElementChild.click();
    details.open = false;
    this.cleanup();
    assert.false(details.open, "cleanup also respects the close before its toggle event runs");

    this.cleanup = addSpoilerCode(this.post);
    details.firstElementChild.click();
    details.open = false;
    this.animations[2].onfinish();
    assert.false(details.open, "animation completion cannot overwrite a recent external close");
  });

  test("redecoration preserves an external toggle before its queued event runs", function (assert) {
    this.post.innerHTML =
      '<details class="bb-spoiler" open><summary>Title</summary><div>Content</div></details>';
    const details = this.post.firstElementChild;
    addSpoilerCode(this.post);

    details.open = false;
    this.cleanup = addSpoilerCode(this.post);
    assert.false(details.open, "cleanup does not restore stale native disclosure state");

    details.open = true;
    this.cleanup();
    assert.true(details.open, "cleanup also preserves a recent external open");
  });

  test("uses immediate native disclosure state when reduced motion is requested", function (assert) {
    window.matchMedia.returns({ matches: true });
    this.post.innerHTML =
      '<details class="bb-spoiler"><summary>Title</summary><div>Content</div></details>';
    const details = this.post.firstElementChild;
    this.cleanup = addSpoilerCode(this.post);
    // Keyboard activation of summary is delivered by the browser as a click.
    details.firstElementChild.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, detail: 0 })
    );
    assert.true(details.open);
    details.firstElementChild.click();
    assert.false(details.open);
    assert.strictEqual(this.animations.length, 0);
  });

  test("embedded summary controls retain their native click handling", function (assert) {
    this.post.innerHTML =
      '<details class="bb-spoiler"><summary>Title <button>Action</button></summary><div>Content</div></details>';
    const details = this.post.firstElementChild;
    this.cleanup = addSpoilerCode(this.post);
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    details.querySelector("button").dispatchEvent(event);
    assert.false(event.defaultPrevented);
    assert.false(details.open);
    assert.strictEqual(this.animations.length, 0);
  });

  test("preview redecoration and cleanup remove prior handlers and animations", function (assert) {
    this.post.innerHTML =
      '<details class="bb-spoiler"><summary>Title</summary><div>Content</div></details>';
    const details = this.post.firstElementChild;
    const oldCleanup = addSpoilerCode(this.post);
    details.firstElementChild.click();
    this.cleanup = addSpoilerCode(this.post);
    assert.true(this.animations[0].cancel.calledOnce);
    oldCleanup();
    details.firstElementChild.click();
    assert.strictEqual(this.animations.length, 2, "one animation for the next click");
    this.cleanup();
    assert.false(details.open, "cleanup settles the pending close");
    assert.strictEqual(details.style.overflow, "");
  });

  test("accordion closes siblings with animation without closing its outer slide", function (assert) {
    this.post.innerHTML =
      '<div class="bb-accordion"><details class="bb-slide" open><summary>Outer</summary><div class="bb-accordion">' +
      '<details class="bb-slide" open><summary>First</summary><div>First content</div></details>' +
      '<details class="bb-slide"><summary>Second</summary><div>Second content</div></details>' +
      "</div></details></div>";
    const [outer, first, second] = this.post.querySelectorAll("details");
    this.cleanup = addAccordionCode(this.post);
    second.firstElementChild.click();
    assert.strictEqual(this.animations.length, 2, "one sibling closes as another opens");
    this.animations.forEach((animation) => {
      assert.deepEqual(animation.options, { duration: 400, easing: "linear" });
      animation.onfinish();
    });
    assert.true(outer.open);
    assert.false(first.open);
    assert.true(second.open);
  });
});
