# frozen_string_literal: true

require_relative "../../../../support/fontsource_stubs"

RSpec.describe BbCode::Font::Action::EnqueueMissingImports do
  include FontsourceStubs

  def cooked_with_fonts(*names)
    spans = names.map { |name| %(<span data-font="#{name}">text</span>) }
    Nokogiri::HTML5.fragment("<p>#{spans.join}</p>")
  end

  def enqueued_font_ids
    Jobs::BbCode::ImportFont.jobs.map { |job| job["args"].first["font_id"] }
  end

  before { reset_font_list_cache }

  describe ".call" do
    let(:font_list) do
      { "inter" => "google", "open-sans" => "google", "roboto" => "google", "other" => "other" }
    end

    before { stub_font_list(font_list) }

    it "enqueues an import for each listed family that is not imported yet" do
      described_class.call(cooked: cooked_with_fonts("Inter", "Open Sans"))

      expect(enqueued_font_ids).to contain_exactly("inter", "open-sans")
    end

    it "enqueues a family used several times only once" do
      described_class.call(cooked: cooked_with_fonts("Inter", "Inter"))

      expect(enqueued_font_ids).to eq(["inter"])
    end

    it "ignores families that Fontsource doesn't list as Google fonts" do
      described_class.call(cooked: cooked_with_fonts("Other", "Comic Sans", "Roboto"))

      expect(enqueued_font_ids).to eq(["roboto"])
    end

    it "ignores families that are already imported" do
      Fabricate(:bb_code_font, font_id: "inter")

      described_class.call(cooked: cooked_with_fonts("Inter", "Roboto"))

      expect(enqueued_font_ids).to eq(["roboto"])
    end

    it "ignores elements without a usable font name" do
      cooked = Nokogiri::HTML5.fragment(<<~HTML)
        <span data-font="">a</span>
        <span>b</span>
        <span data-font="Not a font">c</span>
      HTML

      described_class.call(cooked:)

      expect(enqueued_font_ids).to eq([])
    end

    it "looks at no more than #{described_class::MAX_FONTS_PER_POST} families" do
      ids = (1..12).map { |number| "font-#{number}" }
      stub_font_list(ids.to_h { |id| [id, "google"] })
      reset_font_list_cache

      described_class.call(cooked: cooked_with_fonts(*ids))

      expect(enqueued_font_ids).to eq(ids.first(described_class::MAX_FONTS_PER_POST))
    end

    it "does nothing when the font list is unavailable" do
      reset_font_list_cache
      stub_request(:get, "#{FontsourceStubs::API_URL}/fontlist").to_return(status: 500)

      described_class.call(cooked: cooked_with_fonts("Inter"))

      expect(enqueued_font_ids).to eq([])
    end
  end
end
