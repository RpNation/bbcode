# frozen_string_literal: true

module ::BbCode
  module Fontsource
    # Talks to Fontsource, which serves Google's open source fonts pre-split into
    # unicode-range subsets. Every url is built here from a validated id, version
    # and file name, so callers can only ever reach the two hosts below.
    module Client
      API_URL = "https://api.fontsource.org"
      FILES_URL = "https://cdn.jsdelivr.net/fontsource/fonts"

      MAX_JSON_BYTES = 5.megabytes
      MAX_FILE_BYTES = 2.megabytes
      READ_TIMEOUT_SECONDS = 10

      VERSION_FORMAT = /\A[0-9][0-9A-Za-z.\-]*\z/

      class << self
        # { "inter" => "google", ... }, or nil when Fontsource can't be reached.
        def font_list
          get_json("#{API_URL}/fontlist")
        end

        # Subsets, weights, styles, unicode ranges and the published version of a family.
        def metadata(font_id)
          get_json("#{API_URL}/v1/fonts/#{font_id}") if font_id.match?(ID_FORMAT)
        end

        # The variable axes of a family: {} for a static family, nil when Fontsource can't be reached.
        def axes(font_id)
          return if !font_id.match?(ID_FORMAT)

          get_json("#{API_URL}/v1/variable/#{font_id}", when_missing: {})&.fetch("axes", {})
        end

        def file_url(font_id, version, filename)
          file = FILENAME_FORMAT.match(filename)
          return if file.nil? || !font_id.match?(ID_FORMAT) || !version.match?(VERSION_FORMAT)

          folder = file[:axis] == "wght" ? "#{font_id}:vf" : font_id
          "#{FILES_URL}/#{folder}@#{version}/#{filename}"
        end

        def file_exists?(url)
          !download(url, max_file_size: 1, retain_on_max_file_size_exceeded: true).nil?
        end

        # A Tempfile with the contents of the url, or nil when it can't be downloaded.
        def download(url, max_file_size: MAX_FILE_BYTES, retain_on_max_file_size_exceeded: false)
          fetch(url, max_file_size:, retain_on_max_file_size_exceeded:)
        rescue *network_errors => error
          log_failure(url, error)
          nil
        end

        private

        def network_errors
          [
            OpenURI::HTTPError,
            Excon::Error,
            Net::OpenTimeout,
            Net::ReadTimeout,
            Timeout::Error,
            SocketError,
            SystemCallError,
            OpenSSL::SSL::SSLError,
            EOFError,
            FinalDestination::SSRFDetector::DisallowedIpError,
            FinalDestination::SSRFDetector::LookupFailedError,
          ]
        end

        def fetch(url, max_file_size:, retain_on_max_file_size_exceeded: false)
          FileHelper.download(
            url,
            max_file_size:,
            tmp_file_name: "bbcode-font",
            follow_redirect: true,
            read_timeout: READ_TIMEOUT_SECONDS,
            retain_on_max_file_size_exceeded:,
          )
        end

        def get_json(url, when_missing: nil)
          file = fetch(url, max_file_size: MAX_JSON_BYTES)
          file && JSON.parse(file.read)
        rescue *network_errors, JSON::ParserError => error
          return when_missing if missing?(error) && !when_missing.nil?

          log_failure(url, error)
          nil
        ensure
          file&.close!
        end

        def missing?(error)
          error.is_a?(OpenURI::HTTPError) && error.io.status.first.to_s == "404"
        end

        def log_failure(url, error)
          Rails.logger.warn("BBCode fonts: could not fetch #{url}: #{error.class} #{error.message}")
        end
      end
    end
  end
end
