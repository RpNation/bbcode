# frozen_string_literal: true

# name: BBCode
# about: RpN BBCode Parser Plugin
# version: 0.0.1
# authors: RpNation
# url: https://github.com/RpNation/BBCode
# required_version: 2.7.0

enabled_site_setting :discourse_bbcode_enabled

register_asset "javascripts/bbcode-parser.min.js", :vendored_pretty_text

after_initialize do
  # Code which should run after Rails has finished booting
  # should clear out the context so the initial setup logic for bbcode parser runs
  PrettyText.reset_context()
end
