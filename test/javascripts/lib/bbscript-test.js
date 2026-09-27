import { setupTest } from "ember-qunit";
import { module, test } from "qunit";
import loadScript from "discourse/lib/load-script";

const PARSER_URL = "/plugins/bbcode/javascripts/bbscript-parser.min.js";
const CALLER_ID = "post-test1";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// exercises the built bundle, so rebuild it (pnpm build) after changing bbscript-src
module("Unit | Lib | bbscript", function (hooks) {
  setupTest(hooks);

  let parser;

  hooks.before(async function () {
    await loadScript(PARSER_URL);
    parser = window.bbscriptParser;
  });

  function runV2(source, options = {}) {
    const data = options.data ?? parser.createStore();
    parser.bbscriptProcessorV2.execAll(
      parser.bbscript2Parser.parse(source).ast,
      options.callerId ?? CALLER_ID,
      "",
      { ...options, data }
    );
    return data;
  }

  async function runV1(source, options = {}) {
    const data = options.data ?? parser.createStore();
    await parser.bbscriptProcessorV1.execAll(
      parser.bbscriptProcessorV1.parse(source),
      options.callerId ?? CALLER_ID,
      "",
      { ...options, data }
    );
    return data;
  }

  function fixture(html) {
    const root = document.createElement("div");
    root.innerHTML = html;
    document.querySelector("#qunit-fixture").append(root);
    return root;
  }

  test("syntax", function (assert) {
    assert.deepEqual(
      { ...runV2("(= a 1) (stop) (= b 2)") },
      { a: 1 },
      "stop ends the script"
    );
    assert.deepEqual(
      { ...runV2("; a comment\n(= a 1) // trailing\n(= b ; inner\n 2)") },
      { a: 1, b: 2 },
      "; and // start comments"
    );
    assert.strictEqual(
      runV2('(= s "a\\nb\\tc\\"d\\\\e\\qf")').s,
      'a\nb\tc"d\\e\\qf',
      "known escapes are decoded and unknown ones are kept"
    );
    assert.strictEqual(
      runV2('(= x 5) (= s "x=${x} y=${y}")').s,
      "x=5 y=${y}",
      "${name} interpolates set variables only"
    );
    assert.strictEqual(
      runV2('(= f false) (= r (if f "yes" "no"))').r,
      "no",
      "false is falsy"
    );
    assert.deepEqual(
      { ...runV2("(= true 5)") },
      {},
      "true and false can't be assigned"
    );
    assert.deepEqual(
      parser.bbscript2Parser.parse("(addClass is-open item1)").formattedErrors,
      [],
      "names may contain digits and hyphens"
    );
  });

  test("functions", function (assert) {
    const data = runV2(`
      (= n (+ (number "5") 1))
      (= empty (number ""))
      (= r (range 1 7 2))
      (= tooLong (range 1000000))
      (= tail (slice "hello" 1))
      (= at (find "hello" "l"))
      (= has (contain "hello" "x"))
      (= neg (not true))
      (= _ "kept")
      (each [1 2] (= last _))
      (= missing (slice))
    `);

    assert.strictEqual(data.n, 6, "number converts text");
    assert.true(Number.isNaN(data.empty), "number of blank text is NaN");
    assert.deepEqual(data.r, [1, 3, 5], "range takes a start, end and step");
    assert.strictEqual(data.tooLong, undefined, "range refuses huge lists");
    assert.strictEqual(data.tail, "ello", "slice's end is optional");
    assert.strictEqual(data.at, 2, "find works on text");
    assert.false(data.has, "contain works on text");
    assert.false(data.neg, "not negates");
    assert.strictEqual(data._, "kept", "each restores its loop variable");
    assert.strictEqual(data.last, 2, "each visits every item");
    assert.strictEqual(
      data.missing,
      undefined,
      "a call without its required arguments does nothing"
    );
  });

  test("v1", async function (assert) {
    const data = await runV1(
      'set a 5\nif (leq a 1) (set wrong "yes")\nif (leq 1 a) (set right "yes")'
    );
    assert.deepEqual(
      { ...data },
      { a: 5, right: "yes" },
      "leq compares less than or equal"
    );

    await runV1('print "unterminated', { data });
    assert.true(true, "a missing closing quote doesn't throw");
  });

  test("v1 and v2 share a post's variables", async function (assert) {
    const data = parser.createStore();
    await runV1("set a 5", { data });
    runV2('(++ a) (= b "from v2") (= s "${a}")', { data });
    await runV1('inc a\nset joined "${a} ${b}"', { data });

    assert.deepEqual(
      { ...data },
      { a: 7, b: "from v2", s: "6", joined: "7 from v2" }
    );
  });

  test("isolation", function (assert) {
    assert.deepEqual(
      { ...runV2("(= a 1)", { callerId: "__proto__" }) },
      {},
      "ids cooking can't produce are refused"
    );

    const data = runV2("(= __proto__ 1) (= c (constructor))");
    assert.true(
      Object.hasOwn(data, "__proto__"),
      "__proto__ is an ordinary name"
    );
    assert.strictEqual(data.c, undefined, "constructor isn't a function");
    assert.strictEqual(
      {}.polluted,
      undefined,
      "nothing reaches Object.prototype"
    );

    const other = runV2("(= seen a)");
    assert.strictEqual(other.seen, "a", "another store can't see a variable");
  });

  test("elements are looked up inside the post only", function (assert) {
    const outside = fixture(
      `<div class="box__${CALLER_ID}">outside</div>`
    ).firstElementChild;
    const root = fixture(`
      <div class="box__${CALLER_ID}"><div class="kid__${CALLER_ID}"></div></div>
      <span class="out__${CALLER_ID}"></span>
    `);

    runV2('(setText "hijacked" "a, .box__post-test1") (setText "ok" out)', {
      root,
    });
    assert.strictEqual(
      outside.textContent,
      "outside",
      "selectors can't be injected"
    );
    assert
      .dom(`.out__${CALLER_ID}`, root)
      .hasText("ok", "a class in the post is found");

    runV2('(addDiv (+ "x\\"><img src=x><i class=\\"") box)', { root });
    assert.dom("img", root).doesNotExist("addDiv doesn't parse markup");

    const data = runV2(
      '(toggleClass "open is-big" box) (= has (hasClass "open is-big" box)) (removeDiv kid box) (addDiv made box)',
      { root }
    );
    assert
      .dom(`.box__${CALLER_ID}`, root)
      .hasClass(`open__${CALLER_ID}`)
      .hasClass(`is-big__${CALLER_ID}`);
    assert.true(data.has, "hasClass sees toggled classes");
    assert.strictEqual(
      outside.className,
      `box__${CALLER_ID}`,
      "other posts aren't touched"
    );
    assert
      .dom(`.kid__${CALLER_ID}`, root)
      .doesNotExist("removeDiv removes children");
    assert.dom(`.made__${CALLER_ID}`, root).exists("addDiv adds a scoped div");
  });

  test("timers", async function (assert) {
    const timers = new Set();
    const root = fixture("");
    let foreignFired = false;
    const foreign = setTimeout(() => (foreignFired = true), 20);

    const data = runV2(
      `(clearTimeout ${foreign}) (= n 0) (setInterval 0.005 (++ n))`,
      { root, timers }
    );
    await wait(40);
    assert.true(foreignFired, "a script can't clear timers it doesn't own");
    assert.true(data.n > 0, "the interval runs while the post is on the page");

    root.remove();
    await wait(20);
    const afterRemoval = data.n;
    await wait(30);
    assert.strictEqual(
      data.n,
      afterRemoval,
      "the interval stops once the post leaves the page"
    );
    assert.strictEqual(timers.size, 0, "and releases its handle");
  });
});
