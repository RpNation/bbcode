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
- the old `google-font.js` initializer appended a
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
   needs no lookup call. `data-font` holds just the family name (`Open Sans`);
   weight, italic and axes are in the span's inline style. The cooked HTML never
   depends on the setting, so nothing is rebaked when it is toggled, and the loader
   builds the one URL it will load.
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
cooked post:  <span data-font="Inter" style="font-family: 'Inter', sans-serif; font-weight: 400; ...">
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
                     fetch from Fontsource, store as Upload, 302 to it
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

- `bbcode-font-job:<job class>:<id>`: set when `Action::EnqueueOnce` queues the import or
  the revalidation of a font, for the job's `RETRY_DELAY` (10 minutes for an import, 6
  hours for a revalidation). It keeps one job per font in flight, and doubles as the
  backoff before a font whose job failed is tried again.
- `bbcode-font-file-failed:<id>:<file>`: set for 1 minute after a file couldn't be
  downloaded.
- the font list also leaves `bbcode-fontsource-font-list-unavailable` for 1 minute when
  Fontsource can't be reached, so a cold cache doesn't make every request wait on it.

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
   `404`. Viewers see the fallback stack until the next load. The import is also
   queued when a post using the font is cooked (`post_process_cooked`), so the
   stylesheet usually exists before the first reader arrives.
3. Import is metadata only: `/v1/fonts/{id}` and `/v1/variable/{id}`. It
   generates the canonical CSS and creates the row. No files are downloaded.
4. Prewarming the likely files (Latin and Latin-ext) is not implemented yet.

A failed import writes only the lock key in Redis (10 minutes), which doubles as
the backoff before the family is tried again.

### Revalidation (30 days by default)

Standard stale-while-revalidate with a validator (`BbCode::Font::Revalidate`):

1. A request for the stylesheet finds `checked_at` older than
   `bbcode_font_revalidate_days`. It serves the current CSS immediately and, if it wins
   the Redis claim, enqueues `Jobs::BbCode::RevalidateFont`. Only the winner enqueues.
2. The service fetches the family from Fontsource (`Family.fetch`) and compares its
   `npmVersion` with the stored `version`.
   - Unchanged: set `checked_at = now`. Nothing else changes.
   - Changed: in one transaction retire the stored files (their references are
     re-pointed to `BbCode::RetiredFont`, `updated_at` refreshed), then regenerate `css`
     and `version`; then set `checked_at`. Files are pulled again as they are needed.
     If the new stylesheet is invalid (for example over `MAX_STYLESHEET_BYTES`) the
     transaction rolls back and the font stays on its current version.
   - Unreachable or failed: nothing changes and the current version keeps being served.
     The claim key keeps the font from being tried again for 6 hours. There is no
     attempt cap: a font whose upstream stays broken is retried every 6 hours for as
     long as it is requested.
3. Revalidation never touches `last_used_at`.

A file that is stored again unchanged after being retired (identical bytes dedupe to the
same `Upload`) is both live and retired for the font. The next retirement keeps a single
retired link for it and refreshes its clock, so it can't be swept while a cached
stylesheet might still point at it, and the unique index on references isn't violated.

Freshness (`checked_at`) and usage (`last_used_at`) are separate clocks, so a font
that is in use is revalidated but never deleted.

### Eviction (daily)

`Jobs::BbCode::CleanUpFonts` runs once a day (and does nothing while the plugin is
disabled):

- Each font with `last_used_at` older than `bbcode_font_evict_idle_days` goes through
  `BbCode::Font::Evict`: its uploads (current and retired) are destroyed immediately,
  since no one has a live cached stylesheet for a font idle that long, and the row is
  deleted. An upload that another reference still points at is kept.
- Retired references older than `BbCode::Font::RETIRED_UPLOAD_GRACE` are removed, and
  their uploads destroyed unless something else still refers to them. The grace is
  derived from `BbCode::Font::SERVED_CACHE`, which also sets the cache headers of the
  stylesheet and file routes: the longest a shared cache can keep a response (`shared`
  plus `stale_while_revalidate`) plus a day. Today that is 14 days for the redirect of the file route (the stylesheet's
  is 8), so 15 days.

The sweep runs whether or not `bbcode_self_host_fonts` is on, so turning the feature
off lets the stored fonts age out.

`Jobs::CleanUpUploads` is only a backstop for the crash window between creating
an upload and attaching its reference. It is enabled by default (`clean_up_uploads`
true, grace 48 hours, maximum 168), but admins can disable it and its grace cannot
exceed 7 days, so it is not relied on.

## Fontsource usage

### Upstream usage

- `GET https://api.fontsource.org/fontlist` returns `{ "<id>": "<type>" }`
  (about 51 KB). Cache it in `Rails.cache` for a day, keep only `"google"`
  entries, and never cache a failed fetch (an outage is only remembered for a minute).
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

### Choosing the files (`BbCode::Fontsource::Family`)

Fontsource marking a family `variable` is not enough to rely on. Of the 573
variable Google families (checked against the live API), 17 have no `wght` axis and
54 more declare one but publish no `latin-wght-*` file (for example the Playwrite
families). So the importer probes for the default subset's `wght` file and uses the
variable files only when it exists (502 families); otherwise it falls back to the
static per-weight files, which exist for the other 71.

- Variable: one face per subset and style, `font-weight: <min> <max>` from the
  `wght` axis. Static: one face per weight, style and subset in the metadata.
- Files without a unicode range are skipped (Noto Sans JP has 125 files but 124
  ranges).
- Every value that reaches the stylesheet is validated, since the CSS is served
  from this site's origin: the unicode range, weight, style and file name must be
  well formed or the face is skipped. The check accepts all 12,377 faces with a
  range in a 267 family sample, so it doesn't drop real data.
- File URLs use the exact published version (`<id>[:vf]@<npmVersion>/...`), which
  Fontsource's CDN treats as immutable.

## Client

`assets/javascripts/lib/font-links.js`, used by the `fonts.js` initializer:

- reads `data-font` as a family name and accepts only the shape the tag produces
  (ASCII letters, digits and spaces).
- with `bbcode_self_host_fonts` on, links `/bbcode/fonts/<id>.css` (the family
  normalized like `BbCode::Font.id_for`, through `getURLWithCDN`), so every face of a
  family shares one stylesheet.
- with it off, rebuilds the Google url the tag used to emit from the span's own
  `font-weight`, `font-style` and `font-variation-settings` (axes in alphabetical
  order), so no url from the post is ever put in a `<link>`. For 111 `[font]` tags
  (weights, italics and axes) this gives the same url as the old tag.
- appends one `<link rel="stylesheet">` per stylesheet to `document.head`, shared
  between posts. The decorator returns a cleanup function (the post stream calls
  it when a post is re-rendered or removed) that releases the post's fonts; a link
  is removed once no post uses it, after a short delay so a re-rendering post does
  not flash in the fallback font.

The setting is read each time a post is decorated, so toggling it applies to posts
rendered afterwards. The composer preview cooks as the user types and goes through
the same loader; names that aren't in the font list stop at a cached `404`.

## Tag changes (`bbcode-src/tags/font.js`)

- `data-font` is the family name only. Weight, italic and axes are in the span's
  inline style, which is what the browser matches against the stylesheet and what
  the loader uses to build a Google url when self-hosting is off.
- Add a strict grammar for the family (character allowlist, length cap), which
  also keeps what the loader builds well-formed. Axis values are passed through as
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

## Maintenance tasks

There is no admin page; a site operator manages the cache from the command line
(`lib/tasks/bbcode_fonts.rake`). Each task acts on every site of a multisite unless
`RAILS_DB` is set.

```
bin/rake bbcode:fonts:list                   # what is stored, and how much space it uses
bin/rake "bbcode:fonts:refresh[open-sans]"   # check a font against Fontsource now
bin/rake bbcode:fonts:refresh                # ...or every stored font
bin/rake "bbcode:fonts:purge[open-sans]"     # delete a font and its files now
bin/rake bbcode:fonts:purge                  # ...or all of them (a cleared cache refills on demand)
```

`list` shows each font's version, the number and size of its stored files (retired files
included), when it was last used and last checked, and whether it is `due` for
revalidation or `idle` (the next daily sweep would delete it), plus totals.

`refresh` and `purge` run the same services as the automatic paths with their `force`
option, which skips the check that a font is due or idle: `Revalidate` and `Evict`
take `options: { force: true }`. They print what happened per font (`old -> new`,
`up to date`, `deleted`, or `FAILED` with the steps that failed).

## Settings

- `bbcode_self_host_fonts` (default false, `client: true`).
- `bbcode_font_revalidate_days` (default 30) and `bbcode_font_evict_idle_days`
  (default 90): server only. They are hidden while `bbcode_self_host_fonts` is off and
  shown inline under it when it is on (`depends_behavior: "hidden"`,
  `dependent_setting_display: "inline"`).
- Constants for now: `BbCode::Font::MAX_STYLESHEET_BYTES` (1 MB),
  `Client::MAX_FILE_BYTES` (2 MB),
  `Client::MAX_JSON_BYTES` (5 MB), `EnqueueMissingImports::MAX_FONTS_PER_POST` (10).

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

## Scale: hosting every family

There is no limit on the number of stored families. Measured on 2026-10-27 across all
1,984 Google families Fontsource serves, with the importer's variable-or-static choice
applied (file sizes from jsDelivr's package listings, so the file figures are upper
bounds):

| | |
|---|---|
| Stylesheets in the database | 22.7 MB for 1,984 rows; median family 1 KB, largest 695 KB |
| Font files, if every file were requested | about 1.07 GB in 35,924 files |
| Largest single family | 37.6 MB (Chiron Hei HK) |
| Median family | 72 KB of files; p95 2.2 MB |
| Typical 500 families / the 500 largest | about 36 MB / about 978 MB |

So storage is cheap; what a visitor can cost is upstream load (about 36,000 downloads
from Fontsource's CDN if everything were requested) and backup size.

Stylesheets are large for some families, which is accepted: 97 families exceed 50 KB
raw, 48 exceed 100 KB and 15 (all static CJK families) exceed 300 KB. Gzipped, M PLUS 1p
is about 210 KB, IBM Plex Sans JP 212 KB, Noto Sans JP 273 KB (Google serves roughly
10 KB for these), against 1-3 KB for Inter and Roboto. A variable family stays small
(Noto Sans JP: 99 KB raw). `BbCode::Font::MAX_STYLESHEET_BYTES` (1 MB) is the only
ceiling; the largest stylesheet of the survey is 695 KB.

Not guarded, deliberately: anonymous requests for the stylesheet of any listed family
can still queue its import and then pull its files. Importing only from cooked posts
and a logged-in preview, a total-bytes ceiling and per-IP rate limits on file pulls
were considered and left out for now.

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
   `https://fonts.googleapis.com/css2` origin and path. Specs:
   `spec/lib/font_tag_spec.rb`, and a loader test (now
   `test/javascripts/unit/lib/font-links-test.js`).
2. **PR 2: import pipeline and routes** (implemented, behind the setting):
   - `bbcode_fonts` table and `BbCode::Font` model.
   - `lib/bb_code/fontsource/` (`Client`, `FontList`, `Family`).
   - Services `BbCode::Font::Import` (metadata only; creates the row and its
     generated stylesheet) and `BbCode::Font::PullFile` (stores one font file as an
     `Upload`), plus the actions `BuildStylesheet`, `StoreFile`, `EnqueueOnce` and
     `EnqueueMissingImports`, and `Jobs::BbCode::ImportFont`.
   - `BbCode::FontsController` with the stylesheet and file routes, and the
     `post_process_cooked` hook.
   - The loader's self-hosted mode (see [Client](#client)).
3. **PR 3: revalidation and eviction** (implemented):
   - `BbCode::Font::Revalidate` and `Jobs::BbCode::RevalidateFont`, triggered from the
     stylesheet route through `Action::EnqueueOnce`.
   - `BbCode::Font::Evict`, `Action::DestroyUploads` and the daily
     `Jobs::BbCode::CleanUpFonts`.
   - The `bbcode_font_revalidate_days` and `bbcode_font_evict_idle_days` settings.
4. **Maintenance tasks** instead of an admin page (implemented): `bbcode:fonts:list`,
   `refresh` and `purge`, with a `force` option on `Revalidate` and `Evict`.

Tests: tag parsing and grammar specs; importer and file-pull specs with WebMock
stubs and trimmed Fontsource fixtures (including a CJK-shaped one with `[n]` slice
keys); controller request specs for each state and its headers; job specs for
revalidation (unchanged, changed, failed, lock contention) and the sweep in PR 3;
a QUnit test for the loader (sharing, release, self-hosted mode).

## Open items

Not yet verified:

- How a CDN and browsers treat the css and file routes with these headers, and
  how the `302` to an upload URL is cached.
- Cross-browser behavior (Chromium, Firefox, WebKit): cold and warm cache, a
  persistent profile, a private window. Only Chromium was used so far.
- Whether `X-Accel-Redirect` is available to serve local files directly instead
  of redirecting.
- Synthetic bold/italic is expected (by the font-matching rules) when only a
  regular face is loaded; the face selection was observed, the synthesis was
  not.

Resolved in PR 2:

- The import runs in a job, and is also queued from `post_process_cooked`.
- A missing file is stored and then answered with a `302` to the upload (not the
  bytes), which keeps one code path.
- `UploadCreator` keeps the filename it is given for a new upload (a font file
  stored through `for_theme: true` kept `latin-wght-normal.woff2`).

Needs a decision:

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
- `requires_plugin PLUGIN_NAME` does not work in this plugin: `BbCode::PLUGIN_NAME` is
  `"BbCode"` (it also feeds the engine name) but plugin.rb registers the plugin as
  `"bbcode"`, so the lookup fails (an error in tests, a logged warning in
  production) and the controller is never disabled with the plugin.
  `BbCode::FontsController` uses `requires_plugin "bbcode"`;
  `BbCode::Admin::RefreshController` still has the problem.
