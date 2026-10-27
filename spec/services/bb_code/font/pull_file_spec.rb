# frozen_string_literal: true

require_relative "../../../support/fontsource_stubs"

RSpec.describe BbCode::Font::PullFile do
  include FontsourceStubs

  describe described_class::Contract, type: :model do
    it { is_expected.to validate_presence_of(:font_id) }
    it { is_expected.to validate_presence_of(:filename) }
    it { is_expected.not_to allow_values("Inter", "open_sans", "-inter").for(:font_id) }

    it do
      is_expected.to allow_values("latin-wght-normal.woff2", "0-400-italic.woff2").for(:filename)
    end

    it { is_expected.not_to allow_values("font.woff", "../a.woff2", "a b.woff2").for(:filename) }
  end

  describe ".call" do
    subject(:result) { described_class.call(params:, **dependencies) }

    fab!(:font) { Fabricate(:bb_code_font, version: "5.3.0") }

    let(:params) { { font_id:, filename: } }
    let(:dependencies) { {} }
    let(:font_id) { "inter" }
    let(:filename) { "latin-wght-normal.woff2" }
    let(:file_url) { "#{FontsourceStubs::FILES_URL}/inter:vf@5.3.0/#{filename}" }

    context "when the contract is invalid" do
      let(:filename) { "latin.woff" }

      it { is_expected.to fail_a_contract }
    end

    context "when the font is not imported" do
      let(:font_id) { "roboto" }

      it { is_expected.to fail_to_find_a_model(:font) }
    end

    context "when the font doesn't use the file" do
      let(:filename) { "cyrillic-wght-normal.woff2" }

      it { is_expected.to fail_a_policy(:font_uses_file) }
    end

    context "when the file is already stored" do
      fab!(:upload) do
        Fabricate(:upload).tap do |record|
          record.update_columns(original_filename: "latin-wght-normal.woff2")
        end
      end

      before { UploadReference.create!(target: font, upload:) }

      it { is_expected.to run_successfully }

      it "returns the stored upload without downloading anything" do
        expect(result[:upload]).to eq(upload)
        expect(a_request(:get, /cdn\.jsdelivr\.net/)).not_to have_been_made
      end
    end

    context "when the file is not stored yet" do
      before { stub_font_file(file_url) }

      it { is_expected.to run_successfully }

      it "downloads the file and links it to the font" do
        expect(result[:upload]).to eq(font.stored_upload(filename))
      end
    end

    context "when the file can't be downloaded" do
      before { stub_font_file(file_url, status: 404) }

      it { is_expected.to fail_to_find_a_model(:upload) }
    end
  end
end
