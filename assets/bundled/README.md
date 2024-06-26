# Bundled Dir

Contents in this file are bundled files that will be manually loaded in discourse via `register_asset`. These are specifically files that cannot be placed in conventional asset directorys.

## Files

- `./bbcode-parser.min.js` - source in [/bbcode-src](/bbcode-src)

## Notes

`bbcode-parser.min.js` is in this directory since it is required for server side js.

`bbscript-parser.min.js` is in [/public/javascripts](/public/javascripts) to allow for lazy load/settings check.
