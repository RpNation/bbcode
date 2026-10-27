import { settled } from "@ember/test-helpers";
import { setupTest } from "ember-qunit";
import { module, test } from "qunit";
import {
  addGoogleFontLinks,
  googleFontUrl,
} from "discourse/plugins/bbcode/lib/google-font-links";

const ROBOTO =
  "https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,400";
const LORA = "https://fonts.googleapis.com/css2?family=Lora:ital,wght@1,700";
// eslint-disable-next-line no-script-url
const SCRIPT_URL = "javascript:alert(1)";

function cookedPost(doc, ...fonts) {
  const post = doc.createElement("div");
  post.innerHTML = fonts
    .map((font) => `<span data-font="${font}">text</span>`)
    .join("");
  return post;
}

function linkedFonts(doc) {
  return [...doc.head.querySelectorAll("link")].map((link) =>
    link.getAttribute("href")
  );
}

module("Unit | Lib | google-font-links", function (hooks) {
  setupTest(hooks);

  hooks.beforeEach(function () {
    this.doc = document.implementation.createHTMLDocument("");
  });

  test("googleFontUrl accepts only the google fonts css2 api", function (assert) {
    assert.strictEqual(googleFontUrl(ROBOTO), ROBOTO, "accepts a real url");

    const rejected = [
      null,
      "",
      "Roboto",
      "/css2?family=Roboto",
      "http://fonts.googleapis.com/css2?family=Roboto",
      "https://fonts.googleapis.com.example.com/css2?family=Roboto",
      "https://fonts.googleapis.com@example.com/css2?family=Roboto",
      "https://example.com/https://fonts.googleapis.com/css2?family=Roboto",
      "https://fonts.googleapis.com/other?family=Roboto",
      SCRIPT_URL,
    ];
    rejected.forEach((value) =>
      assert.strictEqual(googleFontUrl(value), null, `rejects ${value}`)
    );
  });

  test("adds one stylesheet link per font to the document head", function (assert) {
    const post = cookedPost(this.doc, ROBOTO, LORA, ROBOTO);

    addGoogleFontLinks(post, this.doc);

    const links = [...this.doc.head.querySelectorAll("link")];
    assert.deepEqual(
      links.map((link) => link.getAttribute("href")),
      [ROBOTO, LORA],
      "links each distinct font once"
    );
    assert.true(
      links.every((link) => link.getAttribute("rel") === "stylesheet"),
      "links are stylesheets"
    );
    assert.strictEqual(
      post.querySelectorAll("link").length,
      0,
      "the post itself is left untouched"
    );
  });

  test("does not link a font that another post already linked", function (assert) {
    addGoogleFontLinks(cookedPost(this.doc, ROBOTO), this.doc);
    addGoogleFontLinks(cookedPost(this.doc, ROBOTO, LORA), this.doc);
    addGoogleFontLinks(cookedPost(this.doc, LORA), this.doc);

    assert.deepEqual(
      [...this.doc.head.querySelectorAll("link")].map((link) =>
        link.getAttribute("href")
      ),
      [ROBOTO, LORA],
      "each font is linked once across posts"
    );
  });

  test("removes a font once the last post using it is released", async function (assert) {
    const releaseFirst = addGoogleFontLinks(
      cookedPost(this.doc, ROBOTO, LORA),
      this.doc
    );
    const releaseSecond = addGoogleFontLinks(
      cookedPost(this.doc, LORA),
      this.doc
    );

    releaseFirst();
    await settled();
    assert.deepEqual(
      linkedFonts(this.doc),
      [LORA],
      "a font another post still uses is kept"
    );

    releaseSecond();
    releaseSecond();
    await settled();
    assert.deepEqual(
      linkedFonts(this.doc),
      [],
      "the font is removed once no post uses it, and releasing twice is harmless"
    );
  });

  test("keeps a font that is claimed again right after it was released", async function (assert) {
    const release = addGoogleFontLinks(cookedPost(this.doc, ROBOTO), this.doc);

    release();
    const link = this.doc.head.querySelector("link");
    addGoogleFontLinks(cookedPost(this.doc, ROBOTO), this.doc);
    await settled();

    assert.strictEqual(
      this.doc.head.querySelector("link"),
      link,
      "a re-rendered post keeps the same stylesheet in place"
    );
    assert.deepEqual(
      linkedFonts(this.doc),
      [ROBOTO],
      "it is still linked once"
    );
  });

  test("ignores data-font values that are not google fonts urls", function (assert) {
    const post = cookedPost(
      this.doc,
      "https://fonts.googleapis.com.example.com/css2?family=Roboto",
      "https://example.com/style.css",
      SCRIPT_URL
    );

    addGoogleFontLinks(post, this.doc);

    assert.strictEqual(
      this.doc.head.querySelectorAll("link").length,
      0,
      "no links are added"
    );
  });
});
