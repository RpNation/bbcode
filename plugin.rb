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
require_relative "lib/bb_code/hidden_content"
require_relative "lib/bb_code/comments"

after_initialize do
  # rebuild the markdown engine with this plugin's rules
  PrettyText.reset_context()

  unless Rails.env.test?
    MessageBus.subscribe(::BbCode::ENGINE_RESET_CHANNEL) { PrettyText.reset_context }
  end

  ::HotlinkedMedia.singleton_class.prepend(::BbCode::CssHotlinkedMedia::ExtendExtractCandidates)
  ::InlineUploads.singleton_class.prepend(::BbCode::CssHotlinkedMedia::RewriteRawCssUrls)

  on(:post_process_cooked) { |doc, post| ::BbCode::CssHotlinkedMedia.rewrite_doc!(doc, post) }

  Plugin::Filter.register(:after_post_cook) { |_post, cooked| ::BbCode::Comments.restore(cooked) }

  on(:reduce_excerpt) { |doc, _options| ::BbCode::HiddenContent.reduce_excerpt!(doc) }
  on(:reduce_cooked) { |doc, post| ::BbCode::HiddenContent.reduce_email!(doc, post) }
  register_modifier(:post_search_index_text) do |text, _post_id, cooked, _locale|
    ::BbCode::HiddenContent.search_text(text, cooked)
  end

  # with discourse_normalize_whitespace off, titles keep non-standard whitespace
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
