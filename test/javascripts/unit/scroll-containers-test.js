import { settled } from "@ember/test-helpers";
import { module, test } from "qunit";
import {
  containBBCodeScrollers,
  decorateBBCodeScrollers,
} from "discourse/plugins/bbcode/discourse/lib/bbcode-scroll-containers";

module("BBCode | Unit | Scroll containers", function (hooks) {
  hooks.beforeEach(function () {
    this.post = document.createElement("div");
    document.getElementById("qunit-fixture").append(this.post);
  });

  test("contains positioned artwork without resizing its author scroll area", function (assert) {
    this.post.innerHTML =
      '<div data-bbcode-div="true" style="width:100px;overflow-x:auto;overflow-y:hidden">' +
      '<div style="width:200px;height:20px">' +
      '<div style="position:absolute;width:200px;height:20px">Artwork</div>' +
      "</div></div>";
    const scroller = this.post.firstElementChild;
    const artwork = scroller.firstElementChild.firstElementChild;

    containBBCodeScrollers(this.post);

    assert.strictEqual(getComputedStyle(scroller).position, "relative");
    assert.strictEqual(artwork.offsetParent, scroller);
    assert.strictEqual(scroller.clientWidth, 100);
    assert.strictEqual(scroller.scrollWidth, 200);
    const initialX = artwork.getBoundingClientRect().x;
    scroller.scrollLeft = 50;
    assert.strictEqual(artwork.getBoundingClientRect().x, initialX - 50);
  });

  test("leaves unmarked HTML and non-scrolling BBCode divs unchanged", function (assert) {
    this.post.innerHTML =
      '<div style="overflow-x:auto">Ordinary HTML</div>' +
      '<div data-bbcode-div="true">Ordinary BBCode div</div>' +
      '<div data-bbcode-div="true" style="overflow:hidden">Clipped div</div>';

    containBBCodeScrollers(this.post);

    for (const element of this.post.children) {
      assert.strictEqual(element.style.position, "");
    }
  });

  test("preserves explicit author positioning", function (assert) {
    const positions = ["absolute", "relative", "fixed", "sticky"];
    this.post.innerHTML = positions
      .map(
        (position) =>
          `<div data-bbcode-div="true" style="position:${position};overflow-x:auto">Content</div>`
      )
      .join("");

    containBBCodeScrollers(this.post);

    assert.deepEqual(
      [...this.post.children].map((element) => element.style.position),
      positions
    );
  });

  test("redecorating stays stable and respects changed author class styles", function (assert) {
    this.post.innerHTML =
      "<style>.bbcode-test-scroller { overflow-x:auto; }</style>" +
      '<div data-bbcode-div="true" class="bbcode-test-scroller">Content</div>';
    const style = this.post.firstElementChild;
    const scroller = this.post.lastElementChild;

    containBBCodeScrollers(this.post);
    const initialStyle = scroller.getAttribute("style");
    containBBCodeScrollers(this.post);
    assert.strictEqual(scroller.getAttribute("style"), initialStyle);

    style.textContent = ".bbcode-test-scroller { position:absolute; overflow-x:auto; }";
    containBBCodeScrollers(this.post);
    assert.strictEqual(scroller.style.position, "");
    assert.strictEqual(getComputedStyle(scroller).position, "absolute");
  });

  test("restores the author value when a div no longer scrolls", function (assert) {
    this.post.innerHTML =
      '<div data-bbcode-div="true" style="position:static;overflow-x:auto">Content</div>';
    const scroller = this.post.firstElementChild;
    containBBCodeScrollers(this.post);
    assert.strictEqual(scroller.style.position, "relative");

    scroller.style.overflowX = "visible";
    containBBCodeScrollers(this.post);
    assert.strictEqual(scroller.style.position, "static");
  });

  test("waits for detached cooked content to be adopted before measuring CSS", async function (assert) {
    const detachedDocument = document.implementation.createHTMLDocument("");
    const post = detachedDocument.createElement("div");
    post.innerHTML =
      "<style>.bbcode-adopted-scroller { overflow-x:auto; }</style>" +
      '<div data-bbcode-div="true" class="bbcode-adopted-scroller">Content</div>';
    const scroller = post.lastElementChild;

    assert.strictEqual(post.ownerDocument.defaultView, null);
    const cleanup = decorateBBCodeScrollers(post);
    assert.strictEqual(scroller.style.position, "");
    this.post.append(post);
    await settled();

    assert.strictEqual(scroller.style.position, "relative");
    cleanup();
  });

  test("cleanup cancels pending decoration before insertion", async function (assert) {
    const detachedDocument = document.implementation.createHTMLDocument("");
    const post = detachedDocument.createElement("div");
    post.innerHTML = '<div data-bbcode-div="true" style="overflow-x:auto">Content</div>';
    const cleanup = decorateBBCodeScrollers(post);
    cleanup();
    this.post.append(post);
    await settled();

    assert.strictEqual(post.firstElementChild.style.position, "");
  });
});
