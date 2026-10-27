# Self-hosted fonts for `[font]`

Status: **design, not implemented.** Written from an investigation of the current
implementation plus measurements against Fontsource and Google Fonts. Items that
were not verified are listed under [Open items](#open-items).

## Goal

Serve the fonts used by `[font]` from the site's own origin or CDN instead of
from Google, to improve client performance (fewer origins and round trips, one
stylesheet per family per page, control over `font-display` and caching) and as
a privacy benefit (viewer IPs are no longer sent to Google).

Non-goals: custom or uploaded fonts, non-Google families, serving anything other
than Google-hosted families, and fixing unrelated BBCode parser issues (see
[Known unrelated issues](#known-unrelated-issues)).

Ships behind `bbcode_self_host_fonts` (default **off**). With it off, the current
Google behavior is unchanged.

## Current behavior

- `bbcode-src/tags/font.js` parses the tag and, for anything not in a small
  web-safe list, builds a Google CSS2 URL for **one** weight/style instance and
  stores it in `data-font` on the span.
- `assets/javascripts/discourse/api-initializers/google-font.js` appends a
  `<link rel="stylesheet">` for each `[data-font]` **inside each post**.
- `bbcode-src/plugins/fontProcess.js` (an `@import` injector) is not referenced.

Problems found (verified unless noted):

- Two dependent round trips across two origins (`fonts.googleapis.com` CSS, then
  `fonts.gstatic.com` files), with a fresh connection to each.
- One request per tag instance. A request for an axis the family lacks (for
  example italic on Noto Sans JP, or `wdth` on Lora) returns **400** and
  nothing loads, not even the regular face. The text then renders in the
  browser default font, because the span's `font-family` has no generic fallback.
- Registered axes (`wdth`, `opsz`, `slnt`, `wght`, `ital`) given as attributes
  are only honored when `style` is also present.
- Family and axis values are interpolated into the URL and into the `style`
  attribute without validation.
- `style="italic"` on its own was ignored (regex bug, **fixed**: see
  `AXES_REGEX` in `font.js`).

### Baseline (current flow, cold cache, Chromium)

Test post: Inter and Lora (Latin) plus a ~70-character Japanese paragraph in
Noto Sans JP. Six runs, identical request counts.

| | |
|---|---|
| Stylesheet requests | 3 (~33 KB) |
| Font file requests | 14 (~209 KB); the Japanese paragraph alone pulled ~11 Noto Sans JP slices |
| Origins | 2, each with its own connection setup (~36-43 ms and 2-18 ms here) |
| First font request to last file done | 195-245 ms unthrottled; 477-501 ms at 80 ms RTT / 10 Mbps |

These come from a fast connection to Google and understate real-world cost.
Compare structure (requests, origins, dependency chain) rather than absolute time.

## Decisions

1. **Source: Fontsource.** Its font files are Google's own (the Latin and
   multi-axis files compared byte-identical to Google's CSS2 output) and it
   provides pre-split subset files plus metadata. It has no key requirement.
   Its API terms are a "fair use" policy rather than a written guarantee; our
   call volume is very low (see [Upstream usage](#upstream-usage)).
2. **Google families only** (`type: "google"` in the font list).
3. **Cache, not permanent storage.** Idle fonts are evicted; used fonts are
   revalidated after 30 days.
4. **Deterministic stylesheet URL** (`/bbcode/fonts/<id>.css`), so the browser
   needs no lookup call. `data-font` carries only the family name.
5. **Deterministic, lazily fetched font files.** A font file is downloaded from
   Fontsource only when a browser first asks for it.
6. **Include every face the family has** (upright and italic, the full weight
   range of a variable font or each static weight). The span keeps its own
   `font-weight`, `font-style` and `font-variation-settings`; the browser picks
   the face. Real bold and italic are available to `**` and `*` inside the tag.
7. **Durable state only for valid fonts.** Invalid or pending fonts never get a
   database row; transient state lives in Redis with TTLs.
8. **Stale content is acceptable** until revalidated or the cache expires; no
   version in our URLs.
9. **Files are `Upload`s**, linked to their font record with `UploadReference`.
10. **We own deletion.** We do not rely on `Jobs::CleanUpUploads`.
11. **Font cache stays in backups for now** (see [Backups](#backups)).

## Architecture

```
cooked post:  <span data-font="Inter" style="font-family:'Inter'; ...">
                    |  client decorator: one <link> per family per page, in <head>
                    v
GET /bbcode/fonts/inter.css            Rails, CDN-cacheable
   row exists   -> 200 css (stored files point straight at their upload URL)
   not in list  -> 404, long cache, no outbound call
   in list      -> import lock + enqueue import, short-cache 404
                    |  css contains @font-face + unicode-range
                    v
stored file     -> direct upload / CDN URL      nginx, S3 or CDN, never Rails
missing file    -> GET /bbcode/fonts/inter/<file>.woff2
                     fetch from Fontsource, respond with the bytes, store as Upload
```

### Why Rails stays in the path

`Upload` URLs contain the sha1 and S3/local paths cannot be renamed, so a family
name cannot be turned into a file URL without a lookup. The stylesheet URL is the
deterministic entry point; everything after it is either a direct upload URL or a
rare miss handled by the file route. Rails is hit roughly once per cache (browser,
CDN edge) per TTL for the CSS, and once per file ever.

## Data model

One table, rows only for valid, successfully imported families.

`bbcode_fonts`

| Column | Notes |
|---|---|
| `font_id` | Fontsource id, unique index |
| `family` | display name |
| `version` | Fontsource `npmVersion` at import / last revalidation |
| `css` | canonical stylesheet, file URLs point at the file route |
| `checked_at` | last successful validation against upstream |
| `last_used_at` | indexed; touched at most once a day |

Files: `Upload`s created with `for_theme: true` (skips image processing; validates
against `theme_authorized_extensions`, whose default includes `woff2`), owned by
the system user, and linked with
`UploadReference(target: BbCode::Font row, upload: ...)`.

Finding a stored file: query the row's references and match
`Upload.original_filename` (for example `latin-wght-normal.woff2`). The set per
row is small (indexed on `(target_type, target_id)`). There is no separate file
map.

Caveat: `UploadCreator` returns an existing record when the sha1 matches and
keeps that record's own filename, so an identical file stored under a different
name would never match and would be re-fetched. This should not happen across
different fonts and is bounded by the per-file lock. With `secure_uploads`
enabled there is no dedupe and each fetch creates a new upload.

Retired files: references to replaced files are re-pointed to
`target_type: "BbCode::RetiredFont"` (same target id). `updated_at` on the
reference is the clock; no extra table or column.

### Transient state (Redis)

- import lock per font id (`NX`, about 10 minutes)
- revalidation claim per font id
- failure backoff per font id (TTL)

## Routes and caching

Both routes follow the `SvgSpriteController` pattern: skip the usual
before-actions, call `no_cookies`, `apply_cdn_headers`, and set explicit
`Cache-Control` (`immutable_for` is available in `ApplicationController`).
Cookies or `Vary: Cookie` would stop shared caches from storing the responses.

`GET /bbcode/fonts/:id.css`
- `public`, a `max-age`/`s-maxage` of about a day, plus `stale-while-revalidate`.
- The response is the stored `css` with the file URLs of already-stored files
  replaced by their upload/CDN URL. Stale cached copies that still contain route
  URLs keep working through the file route.

`GET /bbcode/fonts/:id/:file.woff2`
- Only filenames present in the row's stored `css` are accepted.
- Stored: `302` to the upload URL (cdn-aware), long cache.
- Missing: fetch the exact version from Fontsource (immutable on its CDN) under a
  per-file lock with a short timeout, respond `200` with the bytes and a short
  cache, store the `Upload` (inline or in a job).
- Fetch has to be synchronous: browsers do not retry a failed `@font-face`
  within the same page load.
- Rate limit per IP on anything that can trigger an outbound fetch.

## Lifecycle

### First request for a family

1. Not in the cached Fontsource font list -> `404`, long cache. No outbound call,
   no state stored. (Partial names typed in the composer stop here.)
2. In the list -> take the import lock, enqueue the import, return a short-cache
   `404`. Viewers see the fallback stack until the next load.
3. Import is metadata only: `/v1/fonts/{id}` and `/v1/variable/{id}`. It
   generates the canonical CSS and creates the row. No files are downloaded.
4. Optionally prewarm the likely files (Latin and Latin-ext) in a job.

A failed import writes only a backoff key in Redis.

### Revalidation (30 days)

Standard stale-while-revalidate with a validator:

1. A request finds `checked_at` older than 30 days. It serves the current CSS
   immediately and touches `last_used_at`.
2. It atomically claims the revalidation (Redis lock). Only the winner enqueues.
3. The job fetches `/v1/fonts/{id}` and compares `npmVersion`.
   - Unchanged: set `checked_at = now`.
   - Changed: in one transaction re-point the old references to `RetiredFont`,
     regenerate `css`, update `version` and `checked_at`. Files are re-fetched
     lazily on demand.
   - Failed: keep serving the old version, set a Redis backoff, give up after a
     cap. Nothing partial is ever visible.
4. Revalidation never touches `last_used_at`.

Freshness (`checked_at`) and usage (`last_used_at`) are separate clocks, so a font
that is in use is revalidated but never deleted.

### Eviction (daily sweep)

- Rows with `last_used_at` older than the idle limit (default 90 days): destroy
  their uploads immediately (no one has a live cached stylesheet) and delete the
  row and references.
- Retired references older than the grace period: destroy the upload, unless
  another `UploadReference` still points at it. The grace period must exceed the
  stylesheet `s-maxage` plus stale-while-revalidate (start at 7 days), because
  cached stylesheets may still reference those files.
- Clear stuck revalidation claims.

`Jobs::CleanUpUploads` is only a backstop for the crash window between creating
an upload and attaching its reference. It is enabled by default (`clean_up_uploads`
true, grace 48 hours, maximum 168), but admins can disable it and its grace cannot
exceed 7 days, so it is not relied on.

## Fontsource usage

### Upstream usage

- `GET https://api.fontsource.org/fontlist` returns `{ "<id>": "<type>" }`
  (about 51 KB, has an `ETag`). Cache it in `Rails.cache`, refresh with a
  conditional request about once a day, keep only `"google"` entries.
  (`/v1/fontlist` is a 404; the endpoint is at the root.)
- `GET /v1/fonts/{id}` for metadata (subsets, weights, styles, `unicodeRange`
  per subset, `npmVersion`, `variable`).
- `GET /v1/variable/{id}` for axes and their ranges.
- Files from `cdn.jsdelivr.net/fontsource/fonts/{id}[:vf]@{version}/...`.
- Documented hard limit: 2,500 requests per 10 seconds, with "fair use" and
  possible throttling. Our usage is one list refresh a day plus a handful of
  calls per imported family.
- If the list cannot be fetched and the cache is empty, fail closed with a
  short-cache `404` and retry. Never treat "list unavailable" as "no valid fonts"
  with a long cache.

### Name normalization

Lowercase the family name and replace each run of non-alphanumeric characters
with `-`, trimming hyphens. This matched the Fontsource id for all 1,984 Google
families checked (no mismatches, no duplicate ids or lowercase names). It is not
a documented guarantee. Safeguards: membership in the font list is the validity
check, a spec asserts the rule against a fixture of real names, and the importer
refuses if the normalized slug differs from the id in the metadata.

### Files and subsets

- File naming: `{subset}-{weight}-{style}.woff2` (static) and
  `{subset}-{axis}-{style}.woff2` under `{id}:vf` (variable).
- CJK subsets are numeric slices (`unicodeRange` keys like `[0]`; files like
  `0-wght-normal.woff2`). Noto Sans JP has 124 slices (5.42 MB total woff2) and
  Noto Sans SC 101; Google's CSS2 output has the same slice counts and nearly the
  same total. Strip the brackets when generating filenames.
- Variable fonts: `wght` is included in every axis file. `standard` bundles the
  standard axes, `full` all axes, individual custom axes have their own files.
  Compared byte-identical to Google's output: Open Sans `wdth` (equal to Google's
  `wdth,wght`) and Inter `opsz`. Roboto Flex has `wght`, `wdth`, `opsz`, `slnt`,
  `standard`, `full`, `grad`, `ytuc` (Latin `full` is 326,404 bytes, same as
  Google). Italic files exist only for families that have an italic (Roboto Flex
  returns 404).
- Generate the CSS with `font-display: swap`, `unicode-range` from metadata,
  weight range (`font-weight: min max`) for variable fonts and
  `font-stretch` when `wdth` is present.

## Client

Replace `google-font.js` with a loader that:

- collects `[data-font]` values, dedupes against what is already in the document,
  and appends one `<link rel="stylesheet" href="/bbcode/fonts/<id>.css">` per
  family to `document.head`, shared between posts. The decorator returns a cleanup
  function (the post stream calls it when a post is re-rendered or removed) that
  releases the post's fonts; a link is removed once no post uses it, after a short
  delay so a re-rendering post does not flash in the fallback font. Use `getURL`
  for subfolder installs.
- recognizes legacy `data-font="https://fonts.googleapis.com/css2?family=..."`
  values by extracting the family, so old posts need no rebake.
- falls back to today's Google `<link>` behavior when `bbcode_self_host_fonts` is
  off (the setting must be `client: true`).

The composer preview cooks as the user types and goes through the same loader.
Catalog validation and debouncing keep partial names from causing work.

## Tag changes (`bbcode-src/tags/font.js`)

- `data-font` carries the family name only; weight, italic and axes stay in the
  span's inline style.
- Add a strict grammar for the family (character allowlist, length cap), which
  also keeps the Google URL well-formed. Axis values are passed through as
  written, with no number or range checks: with self-hosting they only appear in
  inline `font-variation-settings`, a bad value in user content is allowed to
  fail on its own, and sanitizing style output is a broader concern for the
  plugin than this tag.
- Add a generic fallback to `font-family`.
- Move the registered-axes merge out of the `if (attrs?.style)` block.
- Remove the dead `fontProcess.js`.

Keep supported syntax as is:

- family: `[font=Family]` / `[font="Family"]`, or `family=` / `name=`;
- `style`: free text with an optional named weight (`thin` 100 ... `black` 900) or
  number 0-900, and optional `italic`, for example `light`, `300 italic`,
  `bold italic`, `italic`;
- registered axes `ital`, `opsz`, `slnt`, `wdth`, `wght` as extra attributes
  (keyed form only);
- web-safe names (`arial`, `book antiqua`, `courier new`, `georgia`, `tahoma`,
  `times new roman`, `trebuchet ms`, `verdana`) render as a plain `font-family`.

## Settings

- `bbcode_self_host_fonts` (default false, `client: true`)
- `bbcode_font_revalidate_days` (30)
- `bbcode_font_evict_idle_days` (90)
- Caps as constants to start: families stored, bytes per family, bytes total,
  per-file size.

Use the `discourse-site-settings` skill when adding them.

## Backups

Uploads are included in backups whenever `backup_with_uploads` is on (default
true); there is no per-path exclusion. Local backups tar the whole uploads
directory (the only exclusion is `optimized/`), and S3 backups select all
`Upload` rows with remote URLs. Excluding the font cache needs a core change
(a filter for both paths, plus reconciling the restored `uploads`,
`upload_references` and `bbcode_fonts` rows with the missing files), which we
estimate at one to two days plus core review. We are deferring it: the cache is
size-bounded, and restored sites get working fonts immediately. Revisit if backup
size becomes a complaint.

## Risks

- The css and file routes are public and unauthenticated. Defenses: font-list
  validation, per-IP rate limits, size and family caps, filename allowlist from
  the stored `css`, and negative caching.
- A cold CJK page triggers many concurrent file misses (about 11 for a short
  Japanese paragraph in the baseline). Mitigate with a per-file lock, a short
  fetch timeout, and a prewarm job for the likely slices.
- Fontsource may lag Google or change its file layout. Treat missing files as a
  failed import, not a crash.
- First view of a never-seen family shows the fallback stack until the import
  completes.
- Fonts are fetched in CORS mode. The default S3 `ASSETS` CORS rule allows `GET`
  and `HEAD` from any origin and exists for fonts, but it is applied only when
  `s3_install_cors_rule` is on.

## Rollout and PR plan

1. **PR 1: tag and loader fixes** (no new infrastructure; implemented): family
   grammar, axis merge fix (axes no longer need
   `style`), `italic`-only `style` fix, generic fallbacks, removal of the dead
   `fontProcess.js` and `data.fonts`, and a loader that adds one `<link>` per
   font to `<head>` (shared across posts and released when the last post using it goes away) and only accepts the exact
   `https://fonts.googleapis.com/css2` origin and path. `data-font` still holds
   the Google URL in this PR; it becomes the family name in PR 2, when the route
   exists and the loader gains legacy-URL handling. Specs:
   `spec/lib/font_tag_spec.rb`, `test/javascripts/unit/lib/google-font-links-test.js`.
2. **PR 2: import pipeline and routes** behind the setting: Fontsource client,
   importer service (`Service::Base`), `bbcode_fonts` migration, css and file
   controllers, settings.
3. **PR 3: revalidation and eviction**: stale-while-revalidate, retirement,
   daily sweep.
4. **PR 4 (optional)**: admin page listing cached fonts with purge and refresh.

Tests (the plugin's `spec/` is currently empty): tag parsing and grammar specs;
importer specs with WebMock stubs and trimmed Fontsource fixtures (include a
CJK-shaped one with `[n]` slice keys); controller specs for each state and its
headers; job specs for revalidation (unchanged, changed, failed, lock
contention) and the sweep; a QUnit test for the loader (dedupe, legacy URLs,
setting off).

## Open items

Not yet verified:

- How a CDN and browsers treat the css and file routes with these headers, and
  how the `302` to an upload URL is cached.
- Cross-browser behavior (Chromium, Firefox, WebKit): cold and warm cache, a
  persistent profile, a private window. Only Chromium was used so far.
- Whether `X-Accel-Redirect` is available to serve local files directly instead
  of redirecting.
- That `UploadCreator` always preserves the filename passed for a new upload.
- Synthetic bold/italic is expected (by the font-matching rules) when only a
  regular face is loaded; the face selection was observed, the synthesis was
  not.

Needs a decision:

- Whether the import runs inline in the request (it is metadata-only and fast) or
  in a job as described, and whether to also trigger it from
  `post_process_cooked` so the stylesheet usually exists before the first reader.
- Extra registered axes (`opsz`, `wdth`, ...) given by a tag: the family-level CSS
  uses one file per slice, and richer files are larger (Roboto Flex Latin: 34 KB
  `wght`, 84 KB `opsz`, 326 KB `full`). Version 1 can support `wght` and `ital`
  fully and let the tag's other axes apply only if the loaded file contains them.
- Whether to ever allow non-Google (`other`) families from the Fontsource list
  (119 at the time of writing).

## Known unrelated issues

Found while investigating; not part of this work:

- `[font=Family style=...]` (single-value form combined with other attributes) is
  not recognized and renders as bare text. Only the keyed form
  (`[font family="..." style="..."]`) works.
- Markdown emphasis wrapped around a BBCode tag that emits a span does not pair:
  `**[font=Roboto]x[/font]**`, and the same with `[color]` and `[size]`, leave the
  literal asterisks. Emphasis inside the tag works. `[b]`/`[i]` wrapping works.
- `pnpm build` in the plugin does not reproduce the committed
  `assets/bundled/bbcode-parser.min.js`: the source imports
  `@bbob/plugin-helper`, which is not declared in `package.json` (pnpm leaves it
  as an unresolved external, which would break server-side cooking), and the
  lockfile's `@bbob` 4.4.1 differs from what the committed bundle was built with
  (4.4.1 adds control-character stripping and blocks `file:` URLs). The committed
  bundle matches `@bbob` 4.2.0 with hoisted dependencies (the repo used yarn
  before it moved to pnpm). To rebuild without changing sanitizer behavior, build
  in a scratch directory with `@bbob/{core,html,preset,preset-html5,plugin-helper}`
  pinned to 4.2.0 plus the rollup devDependencies from `package.json`, using the
  plugin's `bbcode-src` and `rollup.config.js`, then copy only
  `assets/bundled/bbcode-parser.min.js` and its `.map` back. The result differs
  from the committed file only in terser's output style; behavior was checked by
  cooking 398 BBCode samples through both bundles and diffing the output. A
  deliberate `@bbob` upgrade and a declared `@bbob/plugin-helper` dependency
  should be a separate change.
