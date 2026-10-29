# frozen_string_literal: true

require_relative "../../support/fontsource_stubs"

RSpec.describe Jobs::BbCode::RevalidateFont do
  include FontsourceStubs

  describe "#execute" do
    fab!(:font) do
      Fabricate(:bb_code_font, version: "5.3.0", checked_at: 31.days.ago, last_used_at: 3.days.ago)
    end

    it "revalidates the font" do
      stub_family(fontsource_metadata(version: "5.4.0", weights: [400]))

      expect { described_class.new.execute(font_id: "inter") }.to change {
        font.reload.version
      }.from("5.3.0").to("5.4.0")
    end

    it "is silent when the font is not due for revalidation" do
      font.update!(checked_at: 1.day.ago)

      logger = track_log_messages { described_class.new.execute(font_id: "inter") }

      expect(logger.warnings).to be_empty
    end

    it "is silent when the font no longer exists" do
      logger = track_log_messages { described_class.new.execute(font_id: "roboto") }

      expect(logger.warnings).to be_empty
    end

    it "logs a warning when Fontsource can't provide the family" do
      stub_family(fontsource_metadata(version: "5.4.0", weights: [400]))
      stub_request(:get, "#{FontsourceStubs::API_URL}/v1/fonts/inter").to_return(status: 500)

      logger = track_log_messages { described_class.new.execute(font_id: "inter") }

      expect(logger.warnings).to include(include("BBCode fonts: could not revalidate inter"))
    end

    it "keeps the font as it was when Fontsource can't provide the family" do
      stub_family(fontsource_metadata(version: "5.4.0", weights: [400]))
      stub_request(:get, "#{FontsourceStubs::API_URL}/v1/fonts/inter").to_return(status: 500)

      expect { described_class.new.execute(font_id: "inter") }.not_to change {
        font.reload.attributes
      }
    end
  end
end
