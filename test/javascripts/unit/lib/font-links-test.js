import { settled } from "@ember/test-helpers";
import { setupTest } from "ember-qunit";
import { module, test } from "qunit";
import { addFontLinks } from "discourse/plugins/bbcode/lib/font-links";

const GOOGLE = "https://fonts.googleapis.com/css2?family=";
const ROBOTO = `${GOOGLE}Roboto:ital,wght@0,400`;
const LORA_BOLD_ITALIC = `${GOOGLE}Lora:ital,wght@1,700`;
// eslint-disable-next-line no-script-url
const SCRIPT_URL = "javascript:alert(1)";

// A font span the way the font bbcode renders it: the family in data-font, the face in the style.
function fontSpan(family, style = "font-weight: 400; font-style: normal;") {
  return { family, style };
}

function cookedPost(doc, ...spans) {
  const post = doc.createElement("div");
  spans.forEach((span) => {
    const { family, style } = typeof span === "string" ? fontSpan(span) : span;
    const element = doc.createElement("span");
    element.setAttribute("data-font", family);
    element.setAttribute("style", style);
    element.textContent = "text";
    post.appendChild(element);
  });
  return post;
}

function linkedFonts(doc) {
  return [...doc.head.querySelectorAll("link")].map((link) =>
    link.getAttribute("href")
  );
}

module("Unit | Lib | font-links", function (hooks) {
  setupTest(hooks);

  hooks.beforeEach(function () {
    this.doc = document.implementation.createHTMLDocument("");
  });

  test("links the google stylesheet for the face a span asks for", function (assert) {
    const post = cookedPost(
      this.doc,
      "Roboto",
      fontSpan("Lora", "font-weight: 700; font-style: italic;"),
      fontSpan(
        "Open Sans",
        "font-weight: 300; font-style: normal; font-variation-settings: 'wdth' 75;"
      ),
      fontSpan(
        "Roboto Flex",
        "font-weight: 400; font-style: normal; font-variation-settings: 'wdth' 80, 'opsz' 20;"
      )
    );

    addFontLinks(post, { doc: this.doc });

    const links = [...this.doc.head.querySelectorAll("link")];
    assert.deepEqual(
      links.map((link) => link.getAttribute("href")),
      [
        ROBOTO,
        LORA_BOLD_ITALIC,
        `${GOOGLE}Open+Sans:ital,wdth,wght@0,75,300`,
        `${GOOGLE}Roboto+Flex:ital,opsz,wdth,wght@0,20,80,400`,
      ],
      "asks for the weight, italic and axes in the style, axes in alphabetical order"
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

  test("links a font once, however many spans or posts use it", function (assert) {
    addFontLinks(cookedPost(this.doc, "Roboto", "Roboto"), { doc: this.doc });
    addFontLinks(cookedPost(this.doc, "Roboto"), { doc: this.doc });

    assert.deepEqual(linkedFonts(this.doc), [ROBOTO]);
  });

  test("links the stylesheets of this site when fonts are self hosted", function (assert) {
    const post = cookedPost(
      this.doc,
      fontSpan("Open Sans", "font-weight: 300; font-style: normal;"),
      fontSpan("Open Sans", "font-weight: 700; font-style: italic;"),
      "Roboto",
      "IBM Plex Sans",
      "M PLUS 1p",
      "Open  Sans"
    );

    addFontLinks(post, { selfHosted: true, doc: this.doc });

    assert.deepEqual(
      linkedFonts(this.doc),
      [
        "/bbcode/fonts/open-sans.css",
        "/bbcode/fonts/roboto.css",
        "/bbcode/fonts/ibm-plex-sans.css",
        "/bbcode/fonts/m-plus-1p.css",
      ],
      "every face of a family shares one stylesheet, named like the id the server gives the family"
    );
  });

  test("ignores data-font values that are not font names", function (assert) {
    const post = cookedPost(
      this.doc,
      "",
      " ",
      "A".repeat(65),
      "Roboto; color: red",
      "../../etc/passwd",
      "https://example.com/style.css",
      "https://fonts.googleapis.com.example.com/css2?family=Roboto",
      "https://fonts.googleapis.com/css2?family=",
      SCRIPT_URL
    );

    addFontLinks(post, { doc: this.doc });
    addFontLinks(post, { selfHosted: true, doc: this.doc });

    assert.deepEqual(linkedFonts(this.doc), [], "no links are added");
  });

  test("removes a font once the last post using it is released", async function (assert) {
    const releaseFirst = addFontLinks(
      cookedPost(
        this.doc,
        "Roboto",
        fontSpan("Lora", "font-weight: 700; font-style: italic;")
      ),
      { doc: this.doc }
    );
    const releaseSecond = addFontLinks(
      cookedPost(
        this.doc,
        fontSpan("Lora", "font-weight: 700; font-style: italic;")
      ),
      { doc: this.doc }
    );

    releaseFirst();
    await settled();
    assert.deepEqual(
      linkedFonts(this.doc),
      [LORA_BOLD_ITALIC],
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
    const release = addFontLinks(cookedPost(this.doc, "Roboto"), {
      doc: this.doc,
    });

    release();
    const link = this.doc.head.querySelector("link");
    addFontLinks(cookedPost(this.doc, "Roboto"), { doc: this.doc });
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
});
