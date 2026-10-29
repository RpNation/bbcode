# frozen_string_literal: true

class BbCode::Font::Action::BuildStylesheet < Service::ActionBase
  option :family

  # Font files are referenced through the route that fetches them on demand, see `BbCode::Font#stylesheet`.
  def call
    family.faces.map { |face| font_face(face) }.join("\n")
  end

  private

  def font_face(face)
    <<~CSS.strip
      @font-face {
        font-family: '#{css_string(family.name)}';
        font-style: #{face.style};
        font-weight: #{face.weight};
        font-display: swap;
        src: url(#{BbCode::Font.file_path(family.font_id, face.filename)}) format('woff2');
        unicode-range: #{face.unicode_range};
      }
    CSS
  end

  def css_string(value)
    value.gsub(/['\\\n]/) { |character| "\\#{character}" }
  end
end
