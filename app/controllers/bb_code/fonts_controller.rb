# frozen_string_literal: true

module ::BbCode
  class FontsController < ::ApplicationController
    # BbCode::PLUGIN_NAME is not the name plugin.rb registers ("bbcode"), so it cannot be used here
    requires_plugin "bbcode"

    skip_before_action :preload_json,
                       :redirect_to_login_if_required,
                       :redirect_to_profile_if_required,
                       :check_xhr,
                       :verify_authenticity_token

    before_action :ensure_self_hosting_enabled
    before_action :apply_cdn_headers

    CACHE =
      BbCode::Font::SERVED_CACHE.merge(
        missing: {
          browser: 1.minute,
          shared: 1.minute,
        },
        unknown: {
          browser: 1.day,
          shared: 1.day,
        },
      ).freeze

    def stylesheet
      no_cookies

      if (font = BbCode::Font.find_by(font_id: params[:font_id]))
        font.touch_last_used
        if font.revalidation_due?
          BbCode::Font::Action::EnqueueOnce.call(
            job: Jobs::BbCode::RevalidateFont,
            font_id: font.font_id,
          )
        end
        cache_publicly(CACHE[:stylesheet])
        render plain: font.stylesheet, content_type: "text/css"
      else
        render_missing_stylesheet
      end
    end

    def file
      no_cookies

      BbCode::Font::PullFile.call(service_params) do
        on_success do |upload:|
          cache_publicly(CACHE[:file])
          redirect_to UrlHelper.cook_url(upload.url, secure: false), allow_other_host: true
        end
        on_failure do
          cache_publicly(CACHE[:missing])
          head :not_found
        end
      end
    end

    private

    def ensure_self_hosting_enabled
      raise Discourse::NotFound if !SiteSetting.bbcode_self_host_fonts
    end

    # A family Fontsource has but that isn't imported yet is imported in the background, and
    # the browser shows its fallback font until it is; anything else isn't a font we can serve.
    def render_missing_stylesheet
      font_ids = BbCode::Fontsource::FontList.ids

      if font_ids&.include?(params[:font_id])
        BbCode::Font::Action::EnqueueOnce.call(
          job: Jobs::BbCode::ImportFont,
          font_id: params[:font_id],
        )
        cache_publicly(CACHE[:missing])
      else
        cache_publicly(CACHE[font_ids.nil? ? :missing : :unknown])
      end

      head :not_found
    end

    def cache_publicly(durations)
      directives = ["public", "max-age=#{durations[:browser].to_i}"]
      directives << "s-maxage=#{durations[:shared].to_i}"
      if durations[:stale_while_revalidate]
        directives << "stale-while-revalidate=#{durations[:stale_while_revalidate].to_i}"
      end

      response.headers["Cache-Control"] = directives.join(", ")
    end
  end
end
