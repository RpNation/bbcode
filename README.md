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
`pnpm install --frozen-lockfile` and `pnpm build` to regenerate the checked-in parser bundles
and source maps before deploying source changes. Install the full plugin in
Discourse's `plugins/bbcode` directory and restart Discourse and its frontend
build when adding or removing plugin modules.

The parser is registered for both server cooking and browser previews through
Discourse's Markdown plugin pipeline. Ordinary Markdown and core inline
formatting stay on the native path. Custom layout posts retain the plugin's
legacy whitespace conventions. Rendered content still passes through Discourse's
sanitizer; allowed raw HTML remains available outside literal code examples.

After deploying a parser change, restart both Discourse web processes and
Sidekiq before rebuilding existing posts. A changed parser does not automatically
refresh saved cooked HTML. Follow the [deployment and rebake instructions](INTEGRATION_NOTES.md#deployment-and-rebaking)
on the destination server, and check failed jobs as well as the command's final
message.

The [integration notes](INTEGRATION_NOTES.md) describe the changes under review,
focused tests, remaining boundaries, and the tradeoffs of a future contained
HTML/CSS editor. BBScript remains optional and disabled by default.
