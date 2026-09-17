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
- [x] Legacy tables and native Markdown tables
- [x] Legacy numbered and bulleted lists
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
`yarn install --frozen-lockfile` and `yarn build` to regenerate the checked-in parser bundles
and source maps before deploying source changes. Install the full plugin in
Discourse's `plugins/bbcode` directory and restart Discourse and its frontend
build when adding or removing plugin modules.

The parser is registered for both server cooking and browser previews. A native
Markdown plugin invokes it for legacy BBCode and leaves ordinary Markdown on
Discourse's normal path. Rendered content still passes through the native
sanitizer. Interactive features use cooked-post decoration and native HTML
controls.

See [integration notes](INTEGRATION_NOTES.md) for the current compatibility work,
tests, remaining boundaries, and the tradeoffs of a future contained HTML/CSS
editor. BBScript remains optional and disabled by default.
