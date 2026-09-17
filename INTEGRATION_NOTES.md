# Discourse integration review — September 2026

## Direction

Keep the legacy BBCode language for existing posts and authors who use it. A
separate HTML/CSS layout block could be useful for new designs, but changing the
authoring language does not remove the rendering, sanitization, editor, and
maintenance work. This plugin already exposes substantial HTML/CSS through
`[div]`, `[class]`, and the layout tags.

The local compatibility work targets Discourse core revision `c9d27d5d2e`.
Selected public examples from the saved XenForo snapshot are local fixtures,
not part of this repository: the BBCode guide, BBCode+ guide, and Sock Pile.
Their original credits remain visible. The full XenForo database was not
restored and the migration importer was not run.

## Integration improvements

- Register BBCode processing through the native Markdown plugin pipeline rather
  than intercepting assignment of Discourse's Markdown engine.
- Keep ordinary Markdown paragraphs and code handling when no legacy tags are
  present. Respect feature overrides used by chat and the plugin enable setting.
- Use the same registered parser bundle for saved posts and editor previews,
  with Discourse's normal sanitizer after rendering.
- Use native `details` disclosure behavior for spoilers and accordion slides;
  make inline spoiler decoration repeatable and keyboard accessible.
- Restore the table/list syntax used by existing XenForo posts.
- Recover unclosed/misnested legacy layout tags without dropping their content,
  and keep generated, indented layout HTML out of Markdown code blocks.
- Preserve literal hash labels inside authored DIV and NOBR layouts rather than
  turning them into Markdown headings. Native Markdown headings outside those
  layouts and explicit BBCode headings still work. Existing affected posts need
  a rebake after installing the updated parser.
- Read complete default BBCode options with either single or double outer
  quotes, preserving interior CSS quotes and equals signs in URLs. This repairs
  CSS variables/backgrounds in layouts without modifying the author's source.
- Match XenForo tab title spacing so authored visual controls align with the
  radio labels underneath. Ordinary named tabs and keyboard focus remain.
- Keep positioned artwork inside the author's own horizontal scroll container
  on small screens, without shrinking fixed-width designs or adding a second
  scroll area around the post.
- Replace the obsolete admin Handlebars template with a current `.gjs` template.
  Parser refresh uses an authenticated POST request.
- Keep optional BBScript disabled by default. Cleaning up decoration and event
  handlers is not a complete security review of that interpreter.

## HTML/CSS alternatives

### Constrained layouts inside normal posts

This fits Discourse's normal selection, quoting, links, image handling, and
document sizing most closely. It needs a deliberately restricted language:

1. Parse HTML and allow selected layout/formatting elements and attributes.
   Remove executable markup, event handlers, forms, and unapproved embeds.
   Validate URL schemes as well as element names.
2. Parse CSS, validate class/ID tokens, and rewrite every selector and animation
   reference into a generated wrapper the author cannot alter. Random suffixes
   or regular-expression stripping alone are not sufficient.
3. Limit properties/values and resource URLs. Prevent viewport positioning,
   global selectors, imports, and rules that target Discourse controls.
4. Protect layout and paint containment on the wrapper. Containment is useful
   for positioning/clipping, but does not replace HTML/CSS sanitization.
5. Preserve readable text for search, email, quoting, and moderation, and test
   desktop/mobile preview parity.

These restrictions need a compatibility inventory: authors' existing free-form
designs may depend on CSS that the constrained renderer would reject. A shared
rendering layer could eventually support both BBCode and constrained HTML input.

### Sandboxed HTML/CSS frames

For substantially freer CSS, an iframe provides a separate document boundary.
Start with no user scripts, forms, top-level navigation, or same-origin access;
sanitize the content and apply a restrictive content security policy as well.
If frames are served from a URL, use a dedicated origin so opening that URL
directly does not bypass the intended isolation.

This requires more Discourse integration: frame sizing, search and email
fallbacks, selection/quoting, lightboxes, theme colors, responsive behavior,
accessibility, and performance with many posts. Any resizing bridge must be
controlled by the plugin and must not grant arbitrary user scripts access to
the forum. Avoid treating unrestricted iframes as a drop-in post renderer.

## Current boundaries

The legacy plugin's free-form inline styles and custom class styles are not a
security boundary. CSS can affect layout outside the intended content area;
optional `@scope` and random class suffixes do not establish complete isolation.
The BBScript engines also contain global selector and HTML-construction paths
that need a dedicated review before expanding their use.

This compatibility update does not introduce unrestricted user HTML or claim
that the existing BBCode+ language is sandboxed. Legacy optional integrations,
such as Font Awesome kits and remote image/font hosts, still need their normal
configuration and available resources. BBCode+ features missing from the parser
need separate implementation and regression coverage.

The copied BBCode+ guide demonstrates those limits: its layout is available,
but script-driven navigation/examples remain inactive while BBScript is disabled,
and its legacy `[input]` control is not implemented. Use the composer's Markdown
mode to author and edit BBCode; this update does not add a rich-text BBCode editor.

## References

- [HTML iframe sandbox rules](https://html.spec.whatwg.org/multipage/iframe-embed-object.html#attr-iframe-sandbox)
- [Iframe behavior and tradeoffs](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe)
- [CSS paint containment](https://drafts.csswg.org/css-contain/#paint-containment)
- [Shadow DOM encapsulation](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM)

## Focused tests

Inside a Discourse checkout with this plugin installed and frontend assets built:

```sh
RAILS_ENV=test LOAD_PLUGINS=1 bundle exec rspec plugins/bbcode/spec/lib/pretty_text_spec.rb
bundle exec ruby bin/qunit --target bbcode --rails-port 3000 --filter BBCode
```

The server tests use synthetic inputs. Real-source fixture content is kept
outside the plugin checkout and should not be committed as test data.

Local validation on the core revision above: 55 server examples and 13 browser
unit tests passed, along with JavaScript/Ruby/SCSS lint checks. An authenticated
Chromium check covered desktop and an emulated iPhone viewport, the guide and
five Sock Pile samples, spoiler/tab/accordion interactions, Markdown composer
preview, and the admin parser refresh. It checked both console errors and
uncaught errors. This is mobile viewport coverage, not a Safari/iOS device test.

The later hash-label fix adds 10 server boundary regressions. A fresh browser
check verified the original Midnight card and three quoted copies at desktop
and mobile sizes: labels remain 7px and fit inside their card. Browser preview
checks retain native Markdown headings before/after the same legacy layout.
The local fixture refresh corrected 136 accidental headings across 65 posts
without changing any raw post text. Other audit gaps (media, icon dependencies,
some URL syntax, and image sizing) remain separate compatibility work.

The Cyberkill follow-up adds six generic attribute regressions, covering single,
double and unquoted default options, interior CSS quotes, keyed attributes and
URLs containing equals signs. Browser checks verify original and quoted light
and dark variants, including 32 clicks/taps at the visible numbered button
centers across desktop/mobile. A newly authored synthetic layout verifies the
same path with different colors and ordinary named tabs in browser preview.
This fixes shared tag/CSS behavior; production code contains no fixture IDs,
design names, or source-content substitutions.

Pre-PR checks also cover revealed inline-spoiler links reaching Discourse's
delegated handlers and long named tab labels wrapping within narrow layouts.
Short author-overlaid tab controls retain their XenForo-compatible geometry.
