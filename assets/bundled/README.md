# Bundled Dir

Contents in this file are bundled files that will be manually loaded in discourse via `register_asset`. These are specifically files that cannot be placed in conventional asset directorys.

## Files

- `./bbcode-parser.min.js` - source in [/bbcode-src](/bbcode-src)

## Notes

`bbcode-parser.min.js` is in this directory since it is required for server side js.

`bbscript-parser.min.js` is in [/public/javascripts](/public/javascripts) to allow for lazy load/settings check. Its source is in [/bbscript-src](/bbscript-src).

## Rebuilding

Run `pnpm build`. It also rebuilds `public/javascripts/bbscript-parser.min.js`; discard that change with `git checkout` unless `bbscript-src` changed.

The `@bbob/*` packages are pinned to one exact version (plus `pnpm.overrides` for their transitive packages) because minor releases change the rendered output. For example, 4.4 keeps tag names in their written case and strips control characters from attribute values. Before committing a rebuild, compare the old and new bundle's output on real posts.

`bbcode-src` is not covered by the plugin's prettier/eslint scripts. Keep its existing style (100 columns, trailing commas) rather than running core's `bin/lint` on it.
