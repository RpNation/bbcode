![](https://www.rpnation.com/styles/rpnlogo12.png)

# BBCode

RpNation's Official BBCode Implementation for Discourse

See [RpNation](https://www.rpnation.com).

This plugin adds RpNation's custom BBCode to Discourse while using native
Discourse formatting where it already exists. Use Markdown for lists and tables,
and Discourse's own inline bold, italic, underline, and strikethrough tags.
Custom layout tags remain available for designs that need them.

Imported XenForo posts may need source conversion before rebaking: this plugin
does not add XenForo list/table syntax or automatically repair malformed tags.
Markdown headings also work inside layout tags; write `\# label` when the hash
should be literal. See the [integration notes](INTEGRATION_NOTES.md) for migration
and rendering boundaries.

## Features/Planned

Ⓜ️ = The BBCode also has a markdown version

🚧 = In progress or needs CSS.

⌨️ = BBCode also has an HTML equivalent.

🎉 = Powered by official Discourse Addon.

☠️ = Do not proceed. BBob, Markdown, and/or Discourse do not like this code. Unable to be rebaked.

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
- [ ] HTML Comment⌨️
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
- [x] Native Discourse Markdown tables
- [x] Native Discourse numbered and bulleted lists
- [x] Center Block
- [x] Background
- [x] Border
- [x] Scroll Box
- [ ] Div Box
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
- [ ] Font Awesome Icons
- [x] OOC

## Credit

❤️ to Nikolay Kost (JiLiZART) for BBob [GitHub - JiLiZART/BBob: ⚡️Blazing-fast js-bbcode-parser, bbcode js, that transforms and parses to AST with plugin support in pure javascript, no dependencies](https://github.com/JiLiZART/BBob)

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

Parser and tag implementations live in `bbcode-src`. Run
`pnpm install --frozen-lockfile` and `pnpm build` to regenerate the checked-in
parser bundle and source map after source changes. Install the full plugin in
Discourse's `plugins/bbcode` directory.

The same parser bundle serves server cooking and browser previews. A registered
Markdown plugin uses a markdown-it core rule to detect custom BBCode and process
it through BBob. Ordinary Markdown, core inline formatting, and Markdown code
examples containing BBCode keep native behavior when no custom BBCode occurs
outside those examples.

Processing remains per post: a post containing custom BBCode uses the plugin's
legacy whitespace and paragraph behavior throughout the post, including its
surrounding Markdown. This is not isolation of each BBCode span. Rendered output
still passes through Discourse's sanitizer.

Deploying a parser change does not refresh saved cooked HTML. Restart Discourse
web processes and Sidekiq, then follow the
[deployment and rebake instructions](INTEGRATION_NOTES.md#deployment-and-rebaking)
on the destination server. Existing CSS containment, parser resets, and CSS
image rehosting remain in place. BBScript remains optional and disabled by default.
