# Discourse integration review — September 2026

## Direction

Use Discourse's native Markdown and core formatting where possible. Keep custom
BBCode for the additional layout and interaction features. Compatibility fixes
are split into focused pull requests; this document describes the work under
review and does not mean every change has merged or been deployed.

The local compatibility work targets Discourse core revision `c9d27d5d2e`.
Selected public examples from the saved XenForo snapshot are local fixtures,
not part of this repository: the BBCode guide, BBCode+ guide, and Sock Pile.
Their original credits remain visible. The full XenForo database was not
restored and the migration importer was not run.

## Markdown and imported source

- Ordinary Markdown and Discourse's `[b]`, `[i]`, `[u]`, and `[s]` formatting use
  the native parser when no custom BBCode is present. These tags use Discourse's
  existing `bbcode-b`, `bbcode-i`, `bbcode-u`, and `bbcode-s` classes.
- Lists and tables use native Markdown. The proposed XenForo `[list]`, `[*]`,
  `[table]`, `[tr]`, `[td]`, `[th]`, and `[tf]` handlers have been removed from the
  compatibility update. Convert imported source to supported syntax, preserving
  cell contents and checking complex tables individually.
- Markdown headings remain active inside `[div]` and `[nobr]`. Use `\# label`
  for a literal hash at the beginning of a line. Old layouts that relied on
  XenForo treating those lines literally need their source converted; rebaking
  alone cannot infer which headings an author intended.
- The proposed automatic repair of missing or misnested closing tags has been
  removed. Correct malformed source before expecting it to render reliably.
  The underlying BBob parser can drop content from malformed nested tags, so
  inspect those posts during migration rather than relying on a successful
  rebake command as proof of faithful output.
- Custom layout posts still use the plugin's legacy line-break and whitespace
  conventions, including paragraph suppression and handling of indented layout
  markup. They are not a fully native Markdown document model. Core inline
  formatting also has local replacement handlers when nested in a custom layout.

HTML escaping applies only when restoring text hoisted from code or `[plain]`
examples. For example, `[code=html]<details>Example</details>[/code]` displays the
HTML as source. Allowed raw HTML outside examples, including `<details>`, still
passes through Discourse's normal rendering and sanitizer; HTML comments remain
hidden. This does not grant permission for arbitrary HTML or script execution.

## Changes under review

The integration work registers BBCode through Discourse's Markdown pipeline,
uses the same parser bundle for server cooking and browser previews, and
respects the plugin setting and feature overrides used by chat. Spoilers and
accordions use native disclosure elements, with animation and decoration
behavior covered separately. Event-handler cleanup and repeated decoration are
also reviewed independently from parser behavior.

The admin update replaces the obsolete Handlebars template with `.gjs` and uses
an authenticated POST request to refresh the parser. Optional BBScript remains
disabled by default; event-handler cleanup is not a complete security review of
that interpreter.

Layout fixes form separate review work:

- Parse complete default BBCode options with single or double outer quotes,
  preserving interior CSS quotes and equals signs in URLs.
- Align tab labels and their controls while allowing long labels to wrap and
  retaining keyboard focus.
- Keep positioned artwork in the author's horizontal scroll container on small
  screens without adding a second scroll area around the entire post.

These are shared parser or layout fixes, without fixture-specific substitutions.
Their tests do not establish that every historical design renders faithfully.

## Deployment and rebaking

1. Build the parser bundle after changing `bbcode-src`:

   ```sh
   pnpm install --frozen-lockfile
   pnpm build
   ```

2. Deploy the full plugin, including its regenerated bundles. Restart Discourse
   web processes and Sidekiq so both use the new renderer. Restart the frontend
   development build when adding or removing plugin modules.
3. Correct unsupported or malformed imported source before rebuilding it. Check
   representative posts in the preview and after saving.
4. Rebuild existing posts on the destination server. Discourse's standard task,
   run from its application environment, is:

   ```sh
   RAILS_ENV=production bundle exec rake posts:rebake
   ```

   For imported posts, follow the [importer's verified rebake instructions](https://github.com/RpNation/discourse_xf_importer#readme),
   including a fresh run ID after renderer changes. Do not reuse a completed
   checkpoint as evidence that the new renderer has processed those posts.
5. Check failed post IDs and Sidekiq retry/dead jobs. Background post-processing
   must finish too. Inspect representative rendered posts; job completion alone
   does not validate a layout's appearance.

These are server deployment instructions. The full import and site-wide rebake
must not be run on the local development computer.

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

This compatibility work does not introduce unrestricted user HTML or claim that
the existing BBCode+ language is sandboxed. Optional integrations, such as Font
Awesome kits and remote image/font hosts, need their normal configuration and
available resources. Missing BBCode+ features need separate implementation and
regression coverage.

The copied BBCode+ guide contains script-driven examples that remain inactive
while BBScript is disabled, and its legacy `[input]` control is not implemented.
Use the composer's Markdown mode to author and edit BBCode; this work does not
add a rich-text BBCode editor.

Earlier local screenshots and fixture checks included compatibility behavior
that was removed during review, including literal hash labels and malformed-tag
repair. They are not validation of the revised parser. Recheck affected designs
after source conversion and deployment.

## References

- [HTML iframe sandbox rules](https://html.spec.whatwg.org/multipage/iframe-embed-object.html#attr-iframe-sandbox)
- [Iframe behavior and tradeoffs](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe)
- [CSS paint containment](https://drafts.csswg.org/css-contain/#paint-containment)
- [Shadow DOM encapsulation](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM)

## Focused tests

Inside a Discourse checkout with the relevant plugin changes installed and
frontend assets built:

```sh
RAILS_ENV=test LOAD_PLUGINS=1 bundle exec rspec plugins/bbcode/spec/lib/pretty_text_spec.rb
bundle exec ruby bin/qunit --target bbcode --rails-port 3000 --filter BBCode
```

Run the admin request specs when testing the separate admin update. Run the
JavaScript, Ruby, and stylesheet lint checks for the files changed in each pull
request.

Parser regressions cover native Markdown headings, paragraphs, lists, tables,
core inline formatting, code examples, allowed raw HTML, and sanitization. Layout
regressions cover generic attributes rather than copies of user designs.
Browser unit tests cover interactions and repeated decoration for the modules
included in each change.

The server tests use synthetic inputs. Real-source fixture content stays outside
the plugin checkout and should not be committed as test data. Browser unit
checks and emulated mobile viewports do not establish Safari/iOS compatibility or
replace a fresh visual review of the affected local fixtures.
