# XenForo BBCode reference posts

Nine original RpNation posts selected to exercise both small features and complex
user layouts. Each `.txt` contains the complete original BBCode message: no
metadata header, Discourse conversion, local URL rewrite or appended newline.
Copy a file's contents directly into an editor to investigate its behavior.

These are source examples for comparison, not assertions that every tag already
works in Discourse. In particular, XenForo tables/lists and BBCode+ behavior may
need migration or implementation work. Literal `[code]` examples, original
spacing, malformed tags and CSS are intentionally preserved.

## Examples

| File | Original author / post | What it exercises |
| --- | --- | --- |
| [Inline spoilers](guide-inline-spoilers-xf-1171137.txt) | RpNation · [#4](https://www.rpnation.com/threads/31910/post-1171137) | Small disclosure example with literal BBCode inside [code]. |
| [Tabs](guide-tabs-xf-1171145.txt) | RpNation · [#12](https://www.rpnation.com/threads/31910/post-1171145) | Two-tab baseline with both a rendered example and its literal source. |
| [Tables](guide-tables-xf-1171147.txt) | RpNation · [#14](https://www.rpnation.com/threads/31910/post-1171147) | Legacy table variants, header/footer cells, spans, spoilers and code examples. |
| [Accordions](guide-accordions-xf-3290077.txt) | RpNation · [#27](https://www.rpnation.com/threads/31910/post-3290077) | Brace-delimited {slide} panels, width/alignment options and nested content. |
| [BBCode+ guide](guide-bbcode-plus-xf-8634147.txt) | Lyro · [#1](https://www.rpnation.com/threads/388933/post-8634147) | Named classes, targets, inputs, animations/keyframes and the BBScript language. |
| [Sock Pile index](sock-pile-index-xf-12006955.txt) | sox · [#1](https://www.rpnation.com/threads/547824/post-12006955) | Moderate-size layout with CSS variables, positioned columns, scrolling, lists and links. |
| [Sim-ulation](sock-pile-sim-ulation-xf-12006956.txt) | sox · [#2](https://www.rpnation.com/threads/547824/post-12006956) | Light/dark character sheets with gradients, absolute positioning, transforms, icon fonts and images. |
| [Cyberkill](sock-pile-cyberkill-xf-12201301.txt) | sox · [#98](https://www.rpnation.com/threads/547824/post-12201301) | Large nested layout with tabs, flex/scroll panels, fonts, media and layered artwork. |
| [Midnight](sock-pile-midnight-xf-12295501.txt) | sox · [#130](https://www.rpnation.com/threads/547824/post-12295501) | Compact character card with flex/overflow and hash-prefixed labels affected by Markdown headings. |

## Using the examples

Start with the small guide posts, then the Sock Pile index and Sim-ulation.
Cyberkill is the largest example and is useful for testing deeply nested layouts.
Midnight includes the literal hash-prefixed labels from the earlier Markdown
compatibility investigation. The BBCode+ guide adds class, animation and BBScript
syntax that the other examples do not cover.

The examples retain external image/font/media URLs and links to other posts.
Those resources are not bundled, so availability can affect visual comparisons.
The BBCode+ guide's `[script]` examples document the original BBScript language;
this collection is plain text and does not enable scripting or change settings.

## Provenance

All examples came from the existing local snapshot of visible BBCode Center
posts (XenForo node 9483). This is snapshot metadata, not a new check of live-site
visibility. The original threads are:

- [RpNation - BBcode Guide](https://www.rpnation.com/threads/31910/) — RpNation.
- [RpNation - BBCode+ Guide](https://www.rpnation.com/threads/388933/) — Lyro.
- [The Sock Pile](https://www.rpnation.com/threads/547824/) — sox.

[manifest.json](manifest.json) records each author, original thread/post ID,
position in the thread, source link, byte count and SHA-256 hash. Post numbers
come from the snapshot's zero-based position plus one; use the post ID links for
stable references. No private conversations, account records or copied artwork
are included. Existing author/design credits remain inside the original source;
these reference copies do not change their authorship or licensing.
