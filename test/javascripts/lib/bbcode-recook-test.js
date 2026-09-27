import { setupTest } from "ember-qunit";
import { module, test } from "qunit";
import { generateCookFunction } from "discourse/lib/text";
import corpus, { options } from "discourse/plugins/bbcode/recook-corpus";

// A plugin's test run loads no other plugin's markdown, and the bare engine
// has none of the server's lookups, so these cases can't match here. A case
// listed here that starts matching fails too, so the list stays current.
const OTHER_PLUGINS = "needs another plugin's markdown, not loaded here";
const EMOJI = "unicode emoji become images with the server's table only";
const AVATAR = "the quote's avatar comes from the server's lookup";
const DIFFERENT_HERE = {
  "tag-details/alone": OTHER_PLUGINS,
  "tag-details/own-lines": OTHER_PLUGINS,
  "tag-details/own-lines-between-text": OTHER_PLUGINS,
  "tag-details/blank-line-inside": OTHER_PLUGINS,
  "tag-details/markdown-blocks-inside": OTHER_PLUGINS,
  "tag-details/inline-markdown-inside": OTHER_PLUGINS,
  "tag-details/in-blockquote": OTHER_PLUGINS,
  "tag-details/in-list-item": OTHER_PLUGINS,
  "tag-details/around-b": OTHER_PLUGINS,
  "tag-details/in-core-quote": OTHER_PLUGINS,
  "tag-details/misnested-with-i": OTHER_PLUGINS,
  "tag-details/nested-in-itself": OTHER_PLUGINS,
  "tag-details/repeated": OTHER_PLUGINS,
  "tag-details/blank-lines-around": OTHER_PLUGINS,
  "tag-details/[details] alone": OTHER_PLUGINS,
  "tag-details/[details] own-lines": OTHER_PLUGINS,
  "matching/repair-core-details": OTHER_PLUGINS,
  "features/details-in-center": OTHER_PLUGINS,
  "features/center-in-details": OTHER_PLUGINS,
  "features/poll-in-center": OTHER_PLUGINS,
  "features/poll-around-tags": OTHER_PLUGINS,
  "features/footnote-like": OTHER_PLUGINS,
  "features/task-like-list": OTHER_PLUGINS,
  "malformed/brackets-alone": OTHER_PLUGINS,
  "features/emoji-unicode-and-shortcode-in-plain": EMOJI,
  "malformed/unicode-and-rtl": EMOJI,
  "features/quote-with-attribution": AVATAR,
  "scenarios/reply-quoting-with-bbcode": AVATAR,
  'tag-quote/[quote="system, post:1, topic:1"] alone': AVATAR,
  'tag-quote/[quote="system, post:1, topic:1"] own-lines': AVATAR,
};

// The recook baseline (spec/lib/recook_spec.rb) cooked by the composer, which
// must match the server's markdown engine before its cleanup, given the same
// settings. One engine for every case, as the composer keeps, so state left by
// one cook shows too.
module("Unit | Lib | bbcode recook corpus", function (hooks) {
  setupTest(hooks);

  hooks.beforeEach(function () {
    this.owner.lookup("service:site-settings").bbcode_enabled = true;
  });

  // the per-post id is random
  const normalize = (html) => html.replace(/post-[a-z0-9]{5}/g, "post-GUID");

  for (const [group, cases] of Object.entries(corpus)) {
    test(group, async function (assert) {
      const cookFn = await generateCookFunction(options);
      const entries = Object.entries(cases);
      const reason = ([name]) => DIFFERENT_HERE[`${group}/${name}`];
      for (const [name, [raw, expected]] of entries.filter((e) => !reason(e))) {
        assert.strictEqual(normalize(cookFn(raw)), expected, name);
      }
      for (const entry of entries.filter(reason)) {
        const [name, [raw, expected]] = entry;
        assert.notStrictEqual(
          normalize(cookFn(raw)),
          expected,
          `${name}: ${reason(entry)}`
        );
      }
    });
  }
});
