# frozen_string_literal: true

# Bbcode posts have no <p>s, so a long post is thousands of top-level nodes,
# and each css() search or to_html of a Nokogiri fragment costs per top-level
# node (2,000 lines: 430ms). Wrapped in one element, it's paid once. The output
# is the same HTML.
module ::BbCode
  module Cleanup
    NAME = "bbcode-cleanup"
    OPEN = "<#{NAME}>"
    CLOSE = "</#{NAME}>"

    # yields the HTML wrapped, and returns the result unwrapped
    def self.wrapped(html)
      return yield(html) if html.include?(NAME)

      out = yield("#{OPEN}#{html}#{CLOSE}")
      # a custom element only closes on its own end tag, but check rather than assume
      if out.start_with?(OPEN) && out.end_with?(CLOSE)
        out.delete_prefix(OPEN).delete_suffix(CLOSE)
      else
        yield(html)
      end
    end

    def cleanup(html, opts = {})
      return super if !SiteSetting.bbcode_enabled

      ::BbCode::Cleanup.wrapped(html) { |wrapped| super(wrapped, opts) }
    end
  end
end
