# frozen_string_literal: true

# Core's text extraction reads <template>s ([class] CSS, [script]s) like any
# element, so they are removed from excerpts, emails and search. Spoilers are
# hidden from excerpts and emails, and stay searchable, like core's spoilers.
module ::BbCode
  module HiddenContent
    INLINE_SPOILER = ".bb-inline-spoiler"
    BLOCK_SPOILER = "details.bb-spoiler"

    def self.reduce_excerpt!(doc)
      doc.css("template, #{INLINE_SPOILER}").remove
    end

    def self.reduce_email!(doc, post)
      doc.css("template").remove
      doc.css(INLINE_SPOILER).each { |el| el.inner_html = post_link(doc, post).to_html }
      doc
        .css(BLOCK_SPOILER)
        .each do |el|
          title = el.at_css("summary")&.text.to_s
          el.replace(CGI.escapeHTML(title) + " " + post_link(doc, post).to_html)
        end
    end

    # keeps what other modifiers appended (discourse-ai's image captions)
    def self.search_text(text, cooked)
      return text if !cooked&.include?("<template")
      doc = Nokogiri::HTML5.fragment(cooked)
      doc.css("template").remove
      visible = SearchIndexer::HtmlScrubber.scrub(doc.to_html)
      everything = SearchIndexer::HtmlScrubber.scrub(cooked)
      text.start_with?(everything) ? visible + text.delete_prefix(everything) : visible
    end

    def self.post_link(doc, post)
      link = doc.document.create_element("a")
      link["href"] = post&.url.presence || Discourse.base_url
      link.content = I18n.t("bbcode.excerpt_spoiler")
      link
    end
  end
end
