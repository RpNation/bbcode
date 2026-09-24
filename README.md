![](https://www.rpnation.com/styles/rpnlogo12.png)

# BBCode

RpNation's Official BBCode Implementation for Discourse

See: [https://www.rpnation.com]

The goal of this repo and plugin is to provide users with the BBCode suite that they have grown accustomed to when it comes to using our site before our migration to Discourse and make sure that old posts rebake correctly. Above in the chart is marked our status on each BBCode which will hopefully co-exist in tandom even with the markdown/htlm versions provided in the box experience by the Discourse Software.

## Features/Planned

Ⓜ️ = The BBCode also has a markdown version

🚧 = In progress or needs CSS.

⌨️ = BBCode also has an HTML equivalent.

🎉 = Powered by official Discourse Addon.

☠️ = Do not proceed. The parser, Markdown, and/or Discourse do not like this code. Unable to be rebaked.

**General**

- [ ] Refactor stylesheets to fit common discourse styling variables

## Text Formatting

- [x] Headers & Sub-Headers Ⓜ️
- [x] Highlights
- [x] Justified Text
- [x] Blockquotes
- [x] Sub Script ⌨️
- [x] Super Script ⌨️
- [x] Google Font Library
- [x] HTML Comment⌨️
- [x] Paragraph Indent
- [x] Bold, Italic, Underline, Strikethrough Ⓜ️
- [x] Color
- [x] Font Size
- [x] Left, Center, Right
- [x] Spoiler
- [x] Line Break
- [x] NOBR/No Line Break
- [x] Inline Spoiler

## Layout & Design

- [x] Dividers
- [x] Image Float
- [x] Fieldsets
- [x] Sides
- [x] Tabs
- [x] Accordions
- [x] ~~Tables~~ now using markdown tables
- [x] Center Block
- [x] Background
- [x] Border
- [x] Scroll Box
- [x] Div Box
- [x] Anchors
- [x] Rows & Columns

## Media & Embeds

- [x] ~~Google Docs(PDF)~~ Switching to native iframes.
- [x] Height Restrict
- [x] Image
- [x] ~~Challonge - Add as an iframe supported site in settings instead.~~

## Aesthetics

- [x] Print
- [x] Text Message
- [x] Blocks
- [x] Progress Bar
- [x] Sticky Note
- [x] Mail
- [x] Newspaper
- [x] Checks
- [x] Font Awesome Icons
- [x] OOC

## Credit

❤️ to Nikolay Kost (JiLiZART) for BBob [GitHub - JiLiZART/BBob: ⚡️Blazing-fast js-bbcode-parser, bbcode js, that transforms and parses to AST with plugin support in pure javascript, no dependencies](https://github.com/JiLiZART/BBob), which earlier versions of this plugin were built on.

## Steps to start local Discourse docker

Inside the discourse directory, run

```bash
d/boot_dev -p

d/ember-cli -u
```

To kill the container

```bash
d/shutdown_dev
```

For more, see the [Discourse Docker Guide](https://meta.discourse.org/docs?topic=102009)

## Architecture

BBCode is parsed by markdown-it itself: the plugin adds rules to the same markdown-it instance Discourse cooks posts with, so bbcode and markdown are read in one pass and can nest inside each other (a list inside `[center]`, `[b]` across list items, `**bold**` inside `[color]`). The same code runs on the server (`PrettyText.cook`) and in the composer preview.

| File                                                         | Contents                                                                       |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `assets/javascripts/lib/discourse-markdown/bbcode-native.js` | the markdown-it rules                                                          |
| `…/bbcode-native/scanner.js`                                 | finding tags: open tags, their matching close, literal regions, nesting repair |
| `…/bbcode-native/define.js`                                  | the tag definition format                                                      |
| `…/bbcode-native/tags.js`                                    | the tags                                                                       |
| `…/bbcode-native/sections.js`                                | `[tabs]` and `[accordion]`, whose content is a list of child sections          |
| `…/bbcode-native/plus.js`                                    | BBCode+ data tags: `[class]`, `[animation]`, `[script]`, `[fa]`                |
| `…/bbcode-plugin.js`                                         | the sanitizer allowlist and a composer preview fix                             |
| `lib/bb_code/hidden_content.rb`                              | keeps templates and spoilers out of excerpts, emails and the search index      |
| `lib/bb_code/css_hotlinked_media.rb`                         | rehosts images referenced from bbcode CSS, as core does for `<img>`            |
| `lib/bb_code/comments.rb`                                    | turns `[comment]` templates into HTML comments when a post is cooked           |
| `spec/lib/`, `test/javascripts/`                             | server specs, and composer tests that expect the same output                   |

### How a post is parsed

markdown-it cooks a post in stages: core rules run over the whole source, block rules split it into blocks (paragraphs, lists, headings, ...), and inline rules parse the text inside each block. The plugin adds a rule to each stage:

1. **Pre-pass** (core rule `bbcode-native-flatten`, before block parsing) rewrites the source so the block stage sees the structure bbcode means:
   - Mis-nested tags are repaired: `[b][i]x[/b] y[/i]` becomes `[b][i]x[/i][/b] y`.
   - Inside tags whose content is one run of text (`[b]`, `[color]`, ...), newlines are swapped for placeholder characters, so a blank line doesn't end the paragraph halfway through the tag.
   - A block tag that starts mid-line and spans lines (`text [div]...`) is moved onto its own line, so the block stage can see it.
   - A `[code]` that spans lines gets its tags on lines of their own, so it renders as a code block.
2. **Block rule** (`bbcode-native-block`) handles a tag at the start of a line. Its content is parsed again as markdown blocks, so headings, lists and nested tags inside it work. Content on the same line as both tags is read as text instead: `[div]+[/div]` is a "+", not a list.
3. **Inline rule** (`bbcode-native-inline`) handles a tag inside a paragraph; its content is parsed as inline text.
4. **Post-passes** (core rules after parsing) add the line breaks (see below), drop the break after tags that trim it, and put the `[class]`/`[script]` templates at the top of the post.

Tags are matched by the scanner, not by markdown-it's own bbcode parser, because existing content uses unquoted attribute values with spaces and newlines: everything up to the first `]` is the tag, so `[div=height:auto; width:100%]` has one value. A close tag is matched by name and depth. Text inside code and the `literal` tags (`[plain]`, `[icode]`, `[comment]`, `[class]`, `[script]`, ...) is never read as bbcode, not even when matching the close of a tag around it. A tag that is never closed, and a close that matches nothing, stay as literal text.

### Line breaks

Posts are written the way XenForo displays them: every newline is a line break, and there are no paragraphs. So markdown-it runs with `breaks: true`, paragraphs render no `<p>`, and the blank lines markdown-it drops between blocks are counted from where the blocks sit in the source and written back as `<br>`s. On top of that, per tag:

- `trimInside`: no line breaks just inside the tag (`[spoiler]`, `[blockquote]`, `[ooc]`, `[progress]`, ...)
- `trimAfter`: the line break right after the close is dropped, as XenForo does (`[divide]`, `[spoiler]`, `[imagefloat]`, code blocks, ...)
- `lineBreaks: false`: newlines inside are not line breaks (`[nobr]`)

Markdown headings, lists, tables, rules and blockquotes have their own margins, which stand for one blank line: `a\n\n# Heading` looks the same as `a\n# Heading`, and each blank line beyond the first adds a line break.

### Adding a tag

1. Add a definition to `bbcode-native/tags.js`. The format is documented at the top of `bbcode-native/define.js`; most tags are one `element` plus a `content` mode:

   ```js
   check: {
     content: "blocks", // blocks | auto | inline | text | literal | sections
     element: (value) => div({ class: "bb-check", "data-type": value || "dot" }),
     trimAfter: true,
   },
   ```

   - `blocks`: markdown blocks inside when the tag starts its own line (`[center]`, `[div]`)
   - `auto`: inline, even across blank lines, unless the content has markdown blocks (`[b]`, `[color]`)
   - `inline`: always inline (`[sub]`, `[inlinespoiler]`)
   - `text`: a block around one run of text (`[bg]`)
   - `literal`: the content is used as written, by a `render` function; it is never read as bbcode or markdown (`[plain]`, `[icode]`, `[script]`)

2. Allow its HTML in the sanitizer allowlist in `bbcode-plugin.js`.
3. Add its CSS to `assets/stylesheets/common/` and import it from `index.scss`.
4. Add a spec to `spec/lib/native_tags_spec.rb`.

### Known limitations

- A block tag inside a markdown blockquote (`> `) or list item ends up outside it, and so does an inline tag spanning lines inside a blockquote. Use a blank `[quote]` instead of `> `.
- A `[/b]` inside a `$…$` math span still closes the `[b]` around it.
- Tags nested more than 100 deep stay text (core still renders its own `[b]`, `[i]`, `[u]` and `[s]`): each level is a nested parse, and the stack runs out after about a thousand.
- `[comment]` cooks to a `<template data-bbcode-comment>`, because the sanitizer drops HTML comments; `lib/bb_code/comments.rb` turns it into a real HTML comment when a post is cooked. The composer preview and content not cooked as a post (bios, category descriptions) keep the template, which is equally invisible.

### BBScript

BBScript, the scripting language behind `[script]`, lives in `/bbscript-src` and is built with `pnpm build` into `/public/javascripts/bbscript-parser.min.js`, which the client loads only when `enable_bbscript` is on.
