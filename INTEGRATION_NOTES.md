# Discourse integration notes

## Rendering model

BBCode is registered through Discourse's Markdown plugin pipeline, using the
same bundled BBob parser for server cooking and browser previews. A markdown-it
core rule runs before normalization and detects whether the source needs custom
BBCode processing. The `bbcode_enabled` setting and Markdown feature overrides
control whether that rule is registered, including restricted cooks such as chat.

Posts without custom BBCode retain native Markdown paragraphs, headings, lists,
tables, whitespace, and code blocks. Discourse's `[b]`, `[i]`, `[u]`, and `[s]`
tags also stay native on that path. BBCode shown only inside native Markdown
code examples does not enable layout processing.

For a post containing custom BBCode, BBob processes the source before Markdown.
That whole post retains the plugin's legacy whitespace conventions: paragraph
wrappers are suppressed and indented layout markup is not treated as a native
indented code block. These differences apply to surrounding Markdown too; this
implementation does not isolate processing to individual BBCode spans. Core
inline tags nested in those posts use the BBob preset handlers.

A renderer extension restores content hoisted by the parser, including code
examples and custom styles. Restored code text is escaped, so HTML inside
`[code]` or `[plain]` appears as source. Allowed HTML outside code examples still
uses Discourse's normal rendering and sanitization. The integration does not
replace Discourse's engine initialization or bypass its sanitizer.

## Imported source

- Use native Markdown lists and tables. This change adds no XenForo `[list]`,
  `[*]`, `[table]`, `[tr]`, `[td]`, `[th]`, or `[tf]` handlers. Convert unsupported
  imported syntax while preserving its contents; inspect complex tables individually.
- Markdown headings remain active inside layout tags such as `[div]` and
  `[nobr]`. Escape a line's leading hash as `\# label` when it is literal text.
  Rebaking cannot determine the author's original intent.
- This change adds no automatic repair of missing or misnested closing tags.
  Malformed source can lose content during parsing; correct it before relying
  on a rebake to reproduce the original layout.

Use the composer's Markdown mode for BBCode. This change does not add a rich-text
BBCode editor. External fonts, images, and optional Font Awesome kits still need
available resources and their normal configuration.

## Existing safeguards and behavior

The current CSS containment rules, cross-process parser reset, spoiler fix, and
rehosting of external image URLs used in BBCode CSS are retained. Initializers
for fonts, icons, and BBCode highlighting respect the plugin's enabled setting.

Containment and Discourse's sanitizer serve different purposes; this integration
does not establish a sandbox for arbitrary user HTML, CSS, or scripts. BBScript
is optional and remains disabled by default. Expanding that interpreter or
introducing unrestricted HTML requires a separate security review.

## Deployment and rebaking

1. After changing `bbcode-src`, rebuild and include the generated bundle and
   source map:

   ```sh
   pnpm install --frozen-lockfile
   pnpm build
   ```

2. Deploy the full plugin. Restart Discourse web processes and Sidekiq so both
   use the new renderer. Restart the frontend development build when adding or
   removing plugin modules.
3. Correct unsupported or malformed imported source, then compare representative
   posts in the composer preview and after saving.
4. Rebuild saved posts on the destination server from its Discourse environment:

   ```sh
   RAILS_ENV=production bundle exec rake posts:rebake
   ```

   For imported posts, follow the
   [importer's verified rebake instructions](https://github.com/RpNation/discourse_xf_importer#readme),
   using a fresh run ID after renderer changes. A previously completed checkpoint
   does not establish that posts have been rebuilt with the new renderer.
5. Check failed post IDs and Sidekiq retry/dead jobs, allow background processing
   to finish, and inspect representative layouts. Command completion does not
   prove that every imported design renders faithfully.

Run full imports and site-wide rebakes on the migration servers, not on the
local development computer.

## Focused validation

Inside a Discourse checkout with this plugin installed and assets built:

```sh
LOAD_PLUGINS=1 bin/rspec plugins/bbcode/spec/lib/pretty_text_spec.rb
bin/qunit --target bbcode --filter BBCode
```

Check native Markdown and code examples, mixed BBCode layouts, enabled/disabled
settings, sanitization, and preview/save parity. Run lint for changed files and
review desktop and mobile layouts. Synthetic tests and browser emulation do not
establish that all historical designs or Safari/iOS render correctly; retain a
visual review of representative imported posts after source conversion.
