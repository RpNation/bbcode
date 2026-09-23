# frozen_string_literal: true

# name: bbcode
# about: RpN BBCode Parser Plugin
# version: 0.0.1
# authors: RpNation
# url: https://github.com/RpNation/bbcode
# required_version: 2.7.0

enabled_site_setting :bbcode_enabled

register_asset "stylesheets/common/index.scss"

add_admin_route "bbcode.title", "bbcode", use_new_show_route: true

Discourse::Application.routes.append do
  get "/admin/plugins/bbcode/reset" => "admin/plugins#index", :constraints => AdminConstraint.new
end

module ::BbCode
  PLUGIN_NAME = "BbCode"

  ENGINE_RESET_CHANNEL = "/bbcode/engine-reset"
end

require_relative "lib/bb_code/engine"
require_relative "lib/bb_code/css_hotlinked_media"

after_initialize do
  # Code which should run after Rails has finished booting
  # should clear out the context so the initial setup logic for bbcode parser runs
  PrettyText.reset_context()

  unless Rails.env.test?
    MessageBus.subscribe(::BbCode::ENGINE_RESET_CHANNEL) { PrettyText.reset_context }
  end

  ::HotlinkedMedia.singleton_class.prepend(::BbCode::CssHotlinkedMedia::ExtendExtractCandidates)
  ::InlineUploads.singleton_class.prepend(::BbCode::CssHotlinkedMedia::RewriteRawCssUrls)

  on(:post_process_cooked) { |doc, post| ::BbCode::CssHotlinkedMedia.rewrite_doc!(doc, post) }

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
