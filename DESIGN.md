# BBCode plugin: goals, decisions and open work

Working notes for continuing the native parser work. `README.md` describes how the parser works; this file records why it works that way, what was measured, what was tried and rejected, and what is still open. State as of commit `79abe87`.

## Goals

- **XenForo fidelity.** Existing RpNation posts were written against XenForo and must look the same after a rebake. The reference is XenForo's own rendered HTML for real posts (see [Verification](#verification)), not the old BBob output.
- **BBCode and markdown in one parse.** Tags are markdown-it rules on the same instance Discourse cooks with, so markdown works inside tags and tags inside markdown (lists, headings, `**bold**`, polls, details, math). This replaced BBob, which ran as a whole-document HTML pre-processor and broke core markdown around tags.
- **Same code on server and in the composer.** `PrettyText.cook` and the composer preview must produce the same HTML. Every cooking change is checked on both.
- **Malformed input stays visible.** An unclosed tag or an unmatched close is left as literal text; nothing is swallowed or emptied.
- **No core changes unless they improve core on their own.** Plugin needs are met from the plugin. A change goes upstream only when it improves Discourse's default behavior without this plugin, such as the Nokogiri fragment search below.
- **Posts up to 500,000 characters** (production raises `max_post_length` with a separate plugin). Cooking must not fail or approach the 25s JavaScript timeout for any input of that size.

## Design decisions

### Tag syntax and matching

- **Loose tag grammar, ported from BBob's lexer.** Everything up to the first `]` is the tag. If there is no space before the first `=`, the rest is one raw value (`[div=height:auto; width:100%]`); otherwise it is `key=value` pairs. Core's `parseBBCodeTag` stops at whitespace, so the plugin has its own scanner (`scanner.js`) and its own rules instead of core's bbcode ruler.
- **Closes are matched by name and depth.** Each text is scanned once per tag (`tagPairs`), and a "next lower running balance" array turns every `findClose` into a binary-search lookup, so unmatched tags scale linearly.
- **Mis-nesting is repaired, "close and drop", as BBob did:** `[b][i]x[/b] y[/i]` reads `[b][i]x[/i][/b] y`. Only tags closed somewhere take part. Core `[url]`/`[quote]` and `[tab]`/`[slide]` count as parents.
- **Literal regions win.** Fences first, then code spans and literal tags (`[plain]`, `[icode]`, `[comment]`, `[class]`, `[script]`, `[animation]`, `[fa]`) in one left-to-right pass: whichever starts first wins. Nothing inside is read as bbcode, not even when matching an outer tag's close.
- **Escapes apply to openers only.** An odd number of backslashes before `[` makes an opener text. A close can't be escaped: XenForo behaves that way, the BBCode+ guide relies on it (`[div class=code]\[/div]`), and core's own `[wrap]` also ignores escaped closes.
- **Content on the same line as both tags is never markdown blocks:** `[div]+[/div]` is a "+", not a list, and `[center]# Title[/center]` is literal.
- **Inline styling tags stay inline unless they need blocks.** `b`, `i`, `u`, `s`, `color`, `size`, `font`, `pindent`, `highlight` (content `auto`) render a span, even across blank lines. They become a div with block-parsed content only when a line inside is something markdown reads as a block. That test (`needsBlocks`) runs markdown-it's own paragraph-terminating block rules, minus the plugin's block rule.
- **Nesting cap: 100.** Each level of tags is a nested parse, and the stack overflowed at about 1,000–1,600 levels. Beyond 100, counting block and inline tags together, a tag stays text. Core still renders its own `[b]`, `[i]`, `[u]` and `[s]` beyond the cap, without recursion. Depth is carried from the block stage into the inline stage by stamping `meta.bbcodeDepth` on inline tokens and wrapping core's `inline` rule. Text on the same line after a close ("tails") is not nesting: after 100 tails on one line the rest becomes a plain paragraph, which the inline rule handles without recursion.

### Line breaks (user decisions)

- **Every newline is one `<br>`, and there are no `<p>`s** (`breaks: true`, paragraph tags render nothing), as XenForo displays posts. The blank lines markdown-it drops between blocks are counted back from the source line maps.
- **Markdown blocks' own margin stands for one blank line.** Headings, lists, tables, rules and blockquotes have margins, so `a\n\n# Heading` looks the same as `a\n# Heading`; each extra blank line adds a `<br>`.
- **`trimInside`** (no line breaks just inside): `spoiler`, `inlinespoiler`, `blockquote`, `ooc`, `progress`, `thinprogress`, and core `[quote]`.
- **`trimAfter`** (the break right after the close is dropped, as XenForo does): `divide`, `imagefloat`, `spoiler`, `ooc`, `justify`, `check`, `side`, `print`, `block`, `newspaper`, core `[quote]`, and fences. Not center/left/right, by choice.
- **XenForo trims deliberately not reproduced:** after center/left/right, inside headings, and inside `[divide]`/`[imagefloat]` content.
- **`[nobr]`: newlines stay `\n`,** for the browser to treat as whitespace; there is no convert-then-revert pass. `[nobr]` has no element of its own (a "bare" tag), so one starting mid-line stays in the text flow and keeps the spaces around it.
- **`[code]`/`[icode]` content is kept as written,** minus only the newlines the tags sit on. A `[code]` spanning lines renders as a code block wherever its tags sit (core only does this when the opener is alone on its line). **`[plain]`** is unparsed text with every newline a `<br>`.
- **Indented code blocks are disabled** (`md.disable("code")`), because indented bbcode would otherwise become code.
- The PR #165 reviewer asked for explicit agreement on removing `<p>` and disabling indented code. That agreement is still open (see [Open work](#open-work)).

### Individual tags

- **`[comment]`** cooks to `<template data-bbcode-comment>escaped</template>`, because the sanitizer drops HTML comments. `lib/bb_code/comments.rb`, registered as an `after_post_cook` filter, turns it into a real `<!-- -->` comment with Nokogiri. The composer preview and non-post cooks (bios, category descriptions) keep the template, which is equally invisible. Google fonts named inside a comment still load. This replaced hoisting through core's `html_raw` placeholders, whose un-hoisting cost about 0.2s on a post with 600 comments.
- **`[class]`/`[animation]` CSS and `[script]`s** are collected into `<template data-bbcode-plus>` blocks at the top of the post, with one GUID per post so `[div class=x]` matches `[class name=x]`. `lib/bb_code/hidden_content.rb` keeps templates out of excerpts, emails and the search index. `[inlinespoiler]` is removed from excerpts. Spoilers are reduced to a link in emails but stay searchable, as core's do.
- **`[tabs]`/`[accordion]`** children are matched by a direct-child scanner (`sections.js`), which skips literal regions (so `{/slide}` inside a code span doesn't end a slide). Without children, the tag is refused and stays literal.
- **Accepted behavior changes from BBob:** a bare `[message]` or `[tab]` renders standalone; `[block]` renders its content; `[textmessage]` without messages renders an empty shell.
- **Out of scope:** `[media]` (bare-URL oneboxes replace it) and `[input]` (deprecated).
- **`[url]` wrapping a block tag:** the block tag always flows inside `[url]`, because core's `[url]` can't cross a blank line and a block can't go inside `<a>`.
- **BBScript** is built separately from `bbscript-src` and loaded only when `enable_bbscript` is on.

### Server side

- **Monkey patches are allowed only in the prepend style** already used for `HotlinkedMedia`, `InlineUploads` and `TextCleaner`, each with a spec that fails if core renames what it patches.

## Performance: findings

Measurements were taken on the dev machine, so treat them as relative numbers.

### Parsing (JavaScript)

- **Real posts:** #240 (cyberkill, 179K characters, 18 tags deep) takes 250ms to parse on the server and 88ms in the composer. A 500K post of real content takes 0.7–0.9s on the server and 237ms in the composer.
- **Worst cases at 500K** all scale linearly and stay under the 25s timeout. The slowest are nested mid-line `[div]` (about 10s of parsing, 13.6s with cleanup), nested `[tabs]` or `[div]` lines, and `[div]` repeated on one line (about 7s of parsing).
- **Where the parse time goes** (13 heaviest dev posts in the browser, about 290ms per pass):

  | Part | Share |
  |---|---|
  | Plugin: scanning for tag pairs (`tagPairs` / `findClose` / `parseLooseTag` / `isKnown`) | ~19% |
  | Plugin: literal regions | ~6% |
  | Plugin: state setup for nested block parses | ~4% |
  | Core: sanitizer | ~11% |
  | Core: linkify | ~8% |
  | Core: markdown-it tokenizing and rendering | rest |

- **Most plugin scanning is repeated work.** A tag's content is parsed as its own string, so nested texts are rescanned: 54% of scanned characters are the whole post or a paragraph (one pass per tag), 33% nested inline texts, and 12% nested block texts.
- **Why the server is slower than the composer.** Core runs V8 single-threaded (`mini_racer_single_threaded = true`) and calls `low_memory_notification` after every cook, which discards compiled code, so each cook starts cold. Core also rebuilds the markdown-it engine on every cook. Without the per-cook GC, #240 warms from about 215ms to 112ms, and a trivial post drops from 30ms to 7ms. This is core's configuration (needed because the server forks workers) and is out of the plugin's reach.

### HTML cleanup and post processing (Ruby)

- **Nokogiri's `DocumentFragment#css` costs per top-level node.** It runs one XPath search per top-level node and merges the results (`children.css`). Serializing a fragment with `to_html` also costs per node. Without `<p>`, every line of a bbcode post is two top-level nodes (text and `<br>`).
- **Cost of one `css()` search:** 500K of prose lines has 26,315 top-level nodes and takes 425ms per search, against 1ms with the same HTML wrapped in one element. Wrapped and flat searches return identical results: links, topic links, quotes, mentions, oneboxes, excerpts, email HTML, post-process output and search text were all checked.
- **Effect of one wrapper element** (bbcode on, prose lines):

  | Post | Create | Post-process job | Email | Excerpt |
  |---|---|---|---|---|
  | 10K of prose lines | 1.14s → 0.64s | 653 → 193ms | 139 → 9ms | 83 → 6ms |
  | 500K of prose lines | 19.8s → 3.1s | 32.6s → 1.4s | 6.6s → 0.14s | 4.0s → 0.12s |

  Posts built inside layout tags have few top-level nodes and gain nothing: #240 has 20, and 177 of 198 dev posts have fewer than 20.
- **Core without bbcode has the same problem.** markdown-it puts a newline text node between blocks, so each paragraph is about two top-level nodes. A post at the default 32K limit spends 1,069 → 292ms in the post-process job and 949 → 609ms in creation; at 150K the post-process job goes from 5.2s to 0.9s. This is the upstream candidate.
- **Core's `PrettyText.cleanup` ends with a Loofah scrub** that visits every node (about 13–18µs per node). It is the largest part of cleanup for long posts, and plain markdown pays it too.
- **HTML nested more than 400 elements deep** makes Nokogiri refuse the document ("Document tree depth limit exceeded"). Core's own uncapped `[b]` can reach that, with or without the plugin.

### Tried and rejected

| Idea | Result |
|---|---|
| Go back to BBob, or build a bbcode tree first and then markdown (tree-first) | Can't interleave with markdown blocks: `[b]` across list items, markdown inside tags, tags inside core `[quote]`/`[code]`. This is the design the rewrite replaced. |
| One index of all tags per text, instead of one pass per tag | Slower: #240 went from 216 to 249ms. |
| A lazy `TagPairs` class | Slower (230ms). |
| A larger text cache | No measurable change. |
| Parsing inline tag content in place (option "B") | About 10% of parse time on heavy posts (6–7% of a full cook), measured by attributing scanned characters. Below the 15% bar. |
| Parsing block tag content in place (option "C") | About 4%. |
| A single-pass tokenizer for the whole document | Same gain as reusing the parent's scan (below), with a broader change. Whether `[` is a tag depends on markdown context known only during the parse (code spans can't cross blank lines, which depend on the flatten pass; fences; link text), and some nested texts aren't plain slices of the document (blockquote `>` markers and list indentation are stripped). It only pays off combined with in-place parsing, which amounts to a rewrite of the markdown-it integration. |

## Open work

### Decisions for the owner

1. **The PR #165 reviewer's points:** give explicit agreement to removing `<p>` and disabling indented code.
2. **Comment restore speed.** The restore runs unwrapped: 14ms on #240, but 265ms on a flat 2,000-line post with a comment (3ms wrapped). Either add a local wrapper in `comments.rb` (the `wrapped` helper below), or reuse a core helper if the upstream change adds one.
3. **Wrapping every cooked post in one element** (such as `<div class="bbcode-post">`). This is the plugin-side way to remove the per-top-level-node cost everywhere. It changes every post's HTML, so it needs a rebake and a check of CSS that targets direct children of `.cooked`. The Nokogiri fix makes it unnecessary.
4. **Reusing the parent text's scan for nested inline content,** looking up the outer text's tag pairs with an offset in `findClose`. Estimated at 10–15% of parse time on the heaviest posts and negligible on typical ones. It is risky in edge cases: the parent text holds newline placeholders where the nested text has real newlines, which changes code-span detection. Only try it gated by the exact re-cook.

### Upstream candidates (being explored elsewhere)

- **Nokogiri:** make `DocumentFragment#css` (and `search`) run one query over the fragment instead of one per top-level node plus a merge. Check result order, duplicates, and selectors like `:first-child` that apply to top-level nodes.
- **Discourse core:** run `PrettyText.cleanup` on a temporary wrapper element. This is what the stashed plugin patch did:

  ```ruby
  NAME = "bbcode-cleanup" # any custom element: only its own end tag closes it
  def self.wrapped(html)
    return yield(html) if html.include?(NAME)
    out = yield("<#{NAME}>#{html}</#{NAME}>")
    if out.start_with?("<#{NAME}>") && out.end_with?("</#{NAME}>")
      out.delete_prefix("<#{NAME}>").delete_suffix("</#{NAME}>")
    else
      yield(html) # wrapper not intact: clean up unwrapped
    end
  end
  # prepended onto PrettyText's singleton: cleanup(html, opts) -> wrapped(html) { |h| super(h, opts) }
  ```

  Checked on 218 inputs, including hand-written stray-tag HTML: identical output, and the one fallback was the input containing `</bbcode-cleanup>` itself. Result: 2,000 lines of cleanup went from 431ms to 105ms, and #240 was unchanged. The full version, with its spec, is in `git stash` on the original machine as "cleanup wrapper element". Stashes don't travel with the repository.

### Before release

- **Rebake** all posts after deploying; the `[comment]` change alters cooked HTML.
- **Rebuild the search index** too: `hidden_content.rb` changes the indexed text.
- **Production must raise `max_post_length`** to 500,000 with its own plugin (core's maximum for the setting is 150,000). For development, a git-ignored `plugins/dev-post-length/plugin.rb` does the same:

  ```ruby
  after_initialize do
    validator = SiteSetting.type_supervisor.instance_variable_get(:@validators)[:max_post_length]
    validator[:opts][:max] = 500_000 if validator
  end
  ```

  Then run `SiteSetting.max_post_length = 500_000`.

## Verification

Every parser change was held to these gates.

- **Exact re-cook:** cook every dev post that contains a tag, plus every example, with `PrettyText.cook` and then `BbCode::Comments.restore`. Normalize the per-post GUIDs (`post-xxxxx`) and compare byte for byte against a saved baseline. It must show 0 differences, or every difference must be explained and approved.
- **XenForo comparison:** compare visible text runs and `<br>` counts against XenForo's HTML for the same posts, ignoring comments, hidden elements, scripts and templates, and collapsing code blocks. The current result is 16/362 mismatched. The remaining mismatches are known: XenForo trims around center/left/right, `[divide]`/`[imagefloat]` content, and headings; the tabs mismatch is an artifact of label order.
- **Specs and composer tests:** `LOAD_PLUGINS=1 bin/rspec plugins/bbcode/spec` and `bin/qunit plugins/bbcode/test/javascripts/lib/bbcode-native-test.js`.
- **Server and composer:** check both sides for cooking changes. In the composer, `generateCookFunction` from `discourse/lib/text` reuses one engine, as the composer does; `cook()` builds a new one for every call.
- **Timing:** interleave the runs and control GC (`GC.start` before each sample) when comparing Ruby timings; one-off numbers were misleading twice. In post-creation benchmarks, run the variants in both orders, because the first run pays for caches.
- **Visual line-break checks:** raw `<br>` counts mislead, because a `<br>` right before a block or a close doesn't render. Render XenForo's output and ours with the same neutral CSS in a browser and compare where each line lands.

The reference material and scripts lived in a session scratchpad and are **not in this repository**. Bring them over if they're needed:
- `examples/xenforo/*.txt` holds raw posts with the matching `*-html.txt` from XenForo: the tabs, tables, accordions, inline-spoilers and BBCode+ guides, the sock-pile posts (cyberkill, sim-ulation, midnight, index), and a newline probe.
- The scripts are the exact re-cook, the XenForo comparison, the benchmarks, and the 500K stress set.

A `git stash` named "examples" on `main` on the original machine may hold the example files.

## Working conventions

- Code changes are made by editing files directly, not by generated scripts.
- The owner commits; changes are left uncommitted for review.
- If the dev server looks stale after Ruby or plugin changes, restart it rather than working around it.
- Keep comments terse and about why, not what or history. Name things by mechanism, not by plugin, when writing for core.
- Run `bin/lint --fix` on changed files before handing off.
