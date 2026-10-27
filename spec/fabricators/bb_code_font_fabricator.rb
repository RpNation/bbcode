# frozen_string_literal: true

Fabricator(:bb_code_font, class_name: "BbCode::Font") do
  font_id "inter"
  family "Inter"
  version "5.3.0"
  css <<~CSS.strip
    @font-face {
      font-family: 'Inter';
      font-style: normal;
      font-weight: 100 900;
      font-display: swap;
      src: url(/bbcode/fonts/inter/latin-wght-normal.woff2) format('woff2');
      unicode-range: U+0000-00FF,U+0131;
    }
    @font-face {
      font-family: 'Inter';
      font-style: normal;
      font-weight: 100 900;
      font-display: swap;
      src: url(/bbcode/fonts/inter/latin-ext-wght-normal.woff2) format('woff2');
      unicode-range: U+0100-02BA;
    }
  CSS
  checked_at { Time.zone.now }
  last_used_at { Time.zone.now }
end
