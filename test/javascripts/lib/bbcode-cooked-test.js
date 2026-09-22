import { setupTest } from "ember-qunit";
import { module, test } from "qunit";
import { cook } from "discourse/lib/text";

async function cookFragment(raw, options = {}) {
  const html = (await cook(raw, { previewing: true, ...options })).toString();
  return new DOMParser().parseFromString(html, "text/html").body;
}

module("lib:bbcode-cooked", (hooks) => {
  setupTest(hooks);

  hooks.beforeEach(function () {
    this.siteSettings = this.owner.lookup("service:site-settings");
    this.siteSettings.bbcode_enabled = true;
  });

  test("previews mixed-case nested tags through the sanitized pipeline", async (assert) => {
    const fragment = await cookFragment(
      '[SPOILER=Example][I]Hidden[/I]<img src="/example.png" onerror="alert(1)">[/SPOILER]'
    );

    assert.strictEqual(
      fragment.querySelector("details.bb-spoiler > summary").textContent,
      "Spoiler: Example"
    );
    assert.strictEqual(
      fragment.querySelector(".bbcode-i").textContent,
      "Hidden"
    );
    assert.false(fragment.querySelector("details").open);
    assert.strictEqual(fragment.querySelector("[onerror]"), null);
  });

  test("keeps native paragraphs and literal code examples in preview", async (assert) => {
    const example = "[spoiler=Example]Literal[/spoiler]";
    const fragment = await cookFragment(
      `First **paragraph**.\n\n\`\`\`bbcode\n${example}\n\`\`\`\n\nSecond paragraph.`
    );

    assert.deepEqual(
      [...fragment.querySelectorAll("p")].map((p) => p.textContent),
      ["First paragraph.", "Second paragraph."]
    );
    assert.strictEqual(
      fragment.querySelector("pre code").textContent.trim(),
      example
    );
    assert.strictEqual(fragment.querySelector("details"), null);
  });

  test("respects the enabled setting across preview cooks", async function (assert) {
    const raw = "[spoiler=Example]Hidden[/spoiler]";
    assert.true(
      !!(await cookFragment(raw)).querySelector("details.bb-spoiler")
    );

    this.siteSettings.bbcode_enabled = false;
    const disabled = await cookFragment(raw);
    assert.strictEqual(disabled.querySelector("details.bb-spoiler"), null);
    assert.true(disabled.textContent.includes(raw));

    this.siteSettings.bbcode_enabled = true;
    assert.true(
      !!(await cookFragment(raw)).querySelector("details.bb-spoiler")
    );
  });
});
