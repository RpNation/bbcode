# frozen_string_literal: true

module ::BbCode
  module Fontsource
    # The ids of the Google font families Fontsource serves. This is what decides whether a
    # name typed in a post is a real font, so nothing is fetched or stored for anything else.
    module FontList
      CACHE_KEY = "bbcode-fontsource-google-font-ids"
      CACHE_DURATION = 1.day
      UNAVAILABLE_KEY = "bbcode-fontsource-font-list-unavailable"
      UNAVAILABLE_DURATION = 1.minute
      GOOGLE_TYPE = "google"

      # A Set of ids, or nil when Fontsource can't be reached and nothing is cached. An outage is
      # remembered briefly so that a cold cache doesn't send every request to wait on Fontsource.
      def self.ids
        cached = Rails.cache.read(CACHE_KEY)
        return cached if cached
        return if Rails.cache.read(UNAVAILABLE_KEY)

        list = Client.font_list
        if list.nil?
          Rails.cache.write(UNAVAILABLE_KEY, true, expires_in: UNAVAILABLE_DURATION)
          return
        end

        list
          .filter_map { |id, type| id if type == GOOGLE_TYPE }
          .to_set
          .tap { |ids| Rails.cache.write(CACHE_KEY, ids, expires_in: CACHE_DURATION) }
      end
    end
  end
end
