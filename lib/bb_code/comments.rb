# frozen_string_literal: true

# The sanitizer drops HTML comments, so [comment] is cooked to a <template>
# that becomes a real comment here, once per cook instead of once per comment.
module ::BbCode
  module Comments
    SELECTOR = "template[data-bbcode-comment]"
    ESCAPES = { "&" => "&amp;", "<" => "&lt;", ">" => "&gt;", '"' => "&quot;" }

    def self.restore(cooked)
      return cooked if !cooked&.include?("data-bbcode-comment")

      doc = Nokogiri::HTML5.fragment(cooked)
      doc
        .css(SELECTOR)
        .each do |template|
          # escaped, so a "-->" inside can't end it
          template.replace(doc.document.create_comment(template.text.gsub(/[&<>"]/, ESCAPES)))
        end
      doc.to_html
    end
  end
end
