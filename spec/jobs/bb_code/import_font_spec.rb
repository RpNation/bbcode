# frozen_string_literal: true

require_relative "../../support/fontsource_stubs"

RSpec.describe Jobs::BbCode::ImportFont do
  include FontsourceStubs

  before { reset_font_list_cache }

  describe "#execute" do
    it "imports the font" do
      stub_font_list
      stub_family(fontsource_metadata)

      expect { described_class.new.execute(font_id: "inter") }.to change {
        BbCode::Font.exists?(font_id: "inter")
      }.from(false).to(true)
    end

    it "logs a warning when the font can't be imported" do
      stub_font_list({ "roboto" => "google" })

      logger = track_log_messages { described_class.new.execute(font_id: "inter") }

      expect(logger.warnings).to contain_exactly(include("BBCode fonts: could not import inter"))
    end

    it "doesn't create a font when the import fails" do
      stub_font_list({ "roboto" => "google" })

      expect { described_class.new.execute(font_id: "inter") }.not_to change { BbCode::Font.count }
    end
  end
end
