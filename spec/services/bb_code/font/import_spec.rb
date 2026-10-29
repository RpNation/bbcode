# frozen_string_literal: true

require_relative "../../../support/fontsource_stubs"

RSpec.describe BbCode::Font::Import do
  include FontsourceStubs

  describe described_class::Contract, type: :model do
    it { is_expected.to validate_presence_of(:font_id) }
    it { is_expected.to allow_values("inter", "open-sans", "m-plus-1p").for(:font_id) }

    it do
      is_expected.not_to allow_values("Inter", "open_sans", "-inter", "inter-", "a b").for(:font_id)
    end
  end

  describe ".call" do
    subject(:result) { described_class.call(params:, **dependencies) }

    let(:params) { { font_id: } }
    let(:dependencies) { {} }
    let(:font_id) { "inter" }
    let(:font_list) { { "inter" => "google", "some-other" => "other" } }
    let(:metadata) { fontsource_metadata(weights: [400]) }

    before do
      reset_font_list_cache
      stub_font_list(font_list)
      stub_family(metadata)
    end

    context "when the contract is invalid" do
      let(:font_id) { "Not A Font" }

      it { is_expected.to fail_a_contract }
    end

    context "when the family is not listed by Fontsource" do
      let(:font_id) { "unknown" }

      it { is_expected.to fail_a_policy(:listed_google_family) }
    end

    context "when the family is not a Google font" do
      let(:font_id) { "some-other" }

      it { is_expected.to fail_a_policy(:listed_google_family) }
    end

    context "when the font list is unavailable" do
      before do
        reset_font_list_cache
        stub_request(:get, "#{FontsourceStubs::API_URL}/fontlist").to_return(status: 500)
      end

      it { is_expected.to fail_a_policy(:listed_google_family) }
    end

    context "when the font is already imported" do
      fab!(:font, :bb_code_font)

      it { is_expected.to run_successfully }

      it "leaves the font as it was" do
        expect { result }.not_to change { font.reload.attributes }
      end

      it "doesn't ask Fontsource about the family" do
        result

        expect(a_request(:get, %r{api\.fontsource\.org/v1})).not_to have_been_made
      end
    end

    context "when Fontsource can't provide the family" do
      before do
        stub_request(:get, "#{FontsourceStubs::API_URL}/v1/fonts/inter").to_return(status: 500)
      end

      it { is_expected.to fail_to_find_a_model(:family) }
    end

    context "when the family can be imported" do
      it { is_expected.to run_successfully }

      it "creates the font with the version of the family" do
        result

        expect(BbCode::Font.find_by(font_id: "inter")).to have_attributes(
          family: "Inter",
          version: "5.3.0",
        )
      end

      it "generates a stylesheet that references the font files" do
        result

        expect(BbCode::Font.find_by(font_id: "inter").filenames).to eq(
          %w[latin-wght-normal.woff2 latin-ext-wght-normal.woff2],
        )
      end

      it "doesn't download any font file" do
        expect { result }.not_to change { Upload.count }
      end
    end
  end
end
