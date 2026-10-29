# frozen_string_literal: true

require_relative "../../../../support/fontsource_stubs"

RSpec.describe BbCode::Font::Action::BuildStylesheet do
  include FontsourceStubs

  describe ".call" do
    subject(:stylesheet) { described_class.call(family:) }

    let(:metadata) { fontsource_metadata }
    let(:family) do
      BbCode::Fontsource::Family.new(metadata:, axes: fontsource_axes, variable: true)
    end

    it "has one @font-face block per face, referencing the font file routes" do
      expect(stylesheet).to eq(<<~CSS.strip)
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
    end

    context "when the family name contains characters special in a CSS string" do
      let(:metadata) { fontsource_metadata(family: "O'Brien\\\n};body{x:y") }

      it "escapes them so the name stays inside the string" do
        expect(stylesheet).to include("font-family: 'O\\'Brien\\\\\\\n};body{x:y';")
      end
    end

    context "when the family has no usable faces" do
      let(:metadata) { fontsource_metadata(ranges: {}) }

      it { is_expected.to eq("") }
    end
  end
end
