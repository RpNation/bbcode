# frozen_string_literal: true

# name: bbcode
# about: RpN BBCode Parser Plugin
# version: 0.0.1
# authors: RpNation
# url: https://github.com/RpNation/bbcode
# required_version: 2.7.0

enabled_site_setting :bbcode_enabled

register_asset "bundled/bbcode-parser.min.js", :vendored_pretty_text
register_asset "bundled/bbcode-parser.min.js"
register_asset "bundled/bbcode-parser.min.js.map"
register_asset "stylesheets/common/index.scss"

add_admin_route "bbcode.title", "bbcode"

Discourse::Application.routes.append do
  get "/admin/plugins/bbcode" => "admin/plugins#index", :constraints => StaffConstraint.new
end

module ::BbCode
  PLUGIN_NAME = "BbCode"
end

require_relative "lib/bb_code/engine"

after_initialize do
  # Code which should run after Rails has finished booting
  # should clear out the context so the initial setup logic for bbcode parser runs
  PrettyText.reset_context()

  # overrides the default normalize_whitespaces function in discourse/lib/text_cleaner.rb
  # adds discourse_normalize_whitespace setting (defaults to false)
  # when true, normalize_whitespace runs as normal
  # when false, it does nothing, which allows for persistence of non-default whitespace.
  class ::TextCleaner # rubocop:disable Discourse/Plugins/NoMonkeyPatching
    module Optional_normalize_whitespace
      def title_options
        options = super
        options[:normalize_whitespace_opt] = SiteSetting.discourse_normalize_whitespace
        options
      end
      def normalize_whitespaces(text)
        options = title_options
        text = super(text) if (options[:normalize_whitespace_opt])
        text
      end
    end
    singleton_class.prepend Optional_normalize_whitespace
  end
end
