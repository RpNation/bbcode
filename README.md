![](https://www.rpnation.com/styles/rpnlogo12.png)

# BBCode

RpNation's Official BBCode Implementation for Discourse

See: [https://www.rpnation.com]

The goal of this repo and plugin is to provide users with the BBCode suite that they have grown accustomed to when it comes to using our site before our migration to Discourse and make sure that old posts rebake correctly. Above in the chart is marked our status on each BBCode which will hopefully co-exist in tandom even with the markdown/htlm versions provided in the box experience by the Discourse Software.

## Features/Planned

Ⓜ️ = The BBCode also has a markdown version

🚧 = In progress or needs CSS.

✔️ = Complete.

⌨️ = BBCode also has an HTML equivalent.

🎉 = Powered by official Discourse Addon.

☠️ = Do not proceed. BBob, Markdown, and/or Discourse do not like this code. Unable to be rebaked.

**General**

- [ ] Refactor stylesheets to fit common discourse styling variables

## Text Formatting

- [x] Headers & Sub-Headers Ⓜ️
- [x] Highlights ✔️
- [ ] Justified Text
- [ ] Blockquotes
- [ ] Sub Script ⌨️
- [ ] Super Script ⌨️
- [x] Google Font Library ✔️
- [ ] HTML Comment⌨️
- [ ] Paragraph Indent
- [x] Bold, Italic, Underline, Strikethrough Ⓜ️✔️
- [x] Color
- [x] Font Size
- [x] Left, Center, Right ✔️
- [x] Spoiler ✔️
- [ ] Line Break
- [ ] NOBR/No Line Break
- [x] Inline Spoiler ✔️

## Layout & Design

- [ ] Dividers
- [ ] Image Float
- [ ] Fieldsets
- [ ] Sides
- [ ] Tabs
- [ ] Tables
- [ ] Center Block
- [ ] Background
- [ ] Border
- [ ] Scroll Box
- [ ] Div Box
- [ ] Anchors
- [ ] Rows & Columns
- [ ] Chapters

## Media & Embeds

- [ ] Google Docs(PDF)
- [ ] Height Restrict
- [ ] Challonge

## Aesthetics

- [ ] Print
- [ ] Text Message
- [ ] Blocks
- [ ] Progress Bar
- [ ] Sticky Note
- [ ] Mail
- [ ] Newspaper
- [ ] Checks
- [ ] Font Awesome Icons
- [ ] OOC

## Credit

❤️ to Nikolay Kost (JiLiZART) for BBob [GitHub - JiLiZART/BBob: ⚡️Blazing-fast js-bbcode-parser, bbcode js, that transforms and parses to AST with plugin support in pure javascript, no dependencies](https://github.com/JiLiZART/BBob)

## Steps to start local Discourse docker

Inside the discourse directory, run

```bash
d/boot_dev -p

# In one terminal:
d/rails s

# And in a separate terminal
d/ember-cli
```

To kill the container

```bash
d/shutdown_dev
```

For more, see the [Discourse Docker Guide](https://meta.discourse.org/docs?topic=102009)

## Architecture

The architecture of this project is for all BBCode Parser related code to be contaned in `/bbcode-src`, which would then be minified into a module and added to the appropriate location in `/assets/javascripts` to be used by the discourse plugin proper. This is to work around the weird way discourse requires libraries to be loaded in. There will be a Rollup config and github action setup to automate minifying and moving the module.

Honestly, if anyone has a better solution, please send help.
