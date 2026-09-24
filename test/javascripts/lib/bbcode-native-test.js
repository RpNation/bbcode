import { setupTest } from "ember-qunit";
import { module, test } from "qunit";
import { cook } from "discourse/lib/text";

// the server's output, so the composer preview can't drift from the post
module("Unit | Lib | bbcode-native", function (hooks) {
  setupTest(hooks);

  hooks.beforeEach(function () {
    this.owner.lookup("service:site-settings").bbcode_enabled = true;
  });

  async function assertCooks(assert, input, expected, message) {
    assert.strictEqual((await cook(input)).toString(), expected, message);
  }

  test("line breaks", async function (assert) {
    await assertCooks(
      assert,
      "[b]para one\n\npara two[/b]",
      `<span class="bbcode-b">para one<br>\n<br>\npara two</span>`,
      "an inline tag stays one run across a blank line"
    );
    await assertCooks(
      assert,
      "a\n\n\n# H\n\n\nb",
      `a<br><br><h1><a name="h-1" class="anchor" href="#h-1" aria-label="Heading link"></a>H</h1>\n<br>b`,
      "a markdown block's margin stands for one blank line"
    );
    await assertCooks(
      assert,
      "[spoiler]secret[/spoiler]\nafter",
      `<details class="bb-spoiler">\n<summary>\nSpoiler</summary>\n<div class="bb-spoiler-content">secret</div>\n</details>\nafter`,
      "the line break after a trimAfter tag is dropped"
    );
    await assertCooks(
      assert,
      "[nobr]a\nb[/nobr]",
      "a\nb",
      "newlines inside nobr are not line breaks"
    );
  });

  test("markdown inside tags", async function (assert) {
    await assertCooks(
      assert,
      "[div=color:red]\n# Heading\n\n- one\n- two\n[/div]",
      `<div style="color:red">\n<br>\n<h1><a name="heading-1" class="anchor" href="#heading-1" aria-label="Heading link"></a>Heading</h1>\n<ul>\n<li>one</li>\n<li>two</li>\n</ul>\n<br>\n</div>`,
      "a container starting its own line holds markdown blocks"
    );
    await assertCooks(
      assert,
      "[b]a\n[wrap=x]\ny\n[/wrap]\nb[/b]",
      `<div class="bbcode-b">\na<div class="d-wrap" data-wrap="x">\ny</div>\nb</div>`,
      "an inline tag holding another plugin's block renders as a block"
    );
  });

  test("tag matching", async function (assert) {
    await assertCooks(
      assert,
      "[b]bold [i]both[/b] italic[/i]",
      `<span class="bbcode-b">bold <span class="bbcode-i">both</span></span> italic`,
      "a mis-nested tag closes with its parent"
    );
    await assertCooks(
      assert,
      "[div=a]unclosed",
      "[div=a]unclosed",
      "an unclosed tag stays literal"
    );
    await assertCooks(
      assert,
      "\\[b][i]x[/b] y[/i]",
      `[b]<span class="bbcode-i">x[/b] y</span>`,
      "a backslash-escaped opener is text"
    );
    await assertCooks(
      assert,
      "[b]x [nobr]a\nb[/nobr][/b]",
      `<span class="bbcode-b">x a\nb</span>`,
      "a nested nobr keeps its newlines from becoming line breaks"
    );
  });

  test("bbcode-plus templates", async function (assert) {
    await assertCooks(
      assert,
      `a <TEMPLATE Data-BbCode-Plus="class">.d-header{display:none}</TEMPLATE> b`,
      "a <template>.d-header{display:none}</template> b",
      "a template written as raw HTML loses its marker"
    );
    await assertCooks(
      assert,
      `[class name="x{} .d-header{display:none} .y"]color:red[/class]`,
      "",
      "a class name that could escape its rule is dropped"
    );
  });

  test("literal content", async function (assert) {
    await assertCooks(
      assert,
      "x\n[code]\n    [div=x]\n[/div]\n[/code]\nafter",
      `x<br><pre><code class="lang-auto">    [div=x]\n[/div]</code></pre>\nafter`,
      "code keeps its content as written"
    );
    await assertCooks(
      assert,
      "[plain][b]x[/b] :smile:[/plain]",
      "[b]x[/b] :smile:",
      "plain text is read as neither bbcode nor markdown"
    );
    await assertCooks(
      assert,
      "`[plain]`\n[color=red]red[/color]\n`[/plain]`",
      `<code>[plain]</code><br>\n<span style="color: red">red</span><br>\n<code>[/plain]</code>`,
      "a literal tag shown in a code span doesn't start literal text"
    );
  });
});
