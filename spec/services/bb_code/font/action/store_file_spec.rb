# frozen_string_literal: true

require_relative "../../../../support/fontsource_stubs"

RSpec.describe BbCode::Font::Action::StoreFile do
  include FontsourceStubs

  describe ".call" do
    subject(:upload) { described_class.call(font:, filename:) }

    fab!(:font) { Fabricate(:bb_code_font, version: "5.3.0") }

    let(:filename) { "latin-wght-normal.woff2" }
    let(:file_url) { "#{FontsourceStubs::FILES_URL}/inter:vf@5.3.0/#{filename}" }

    context "when the file can be downloaded" do
      before { stub_font_file(file_url, body: "font-bytes") }

      it "stores the file as an upload named after it" do
        expect(upload).to have_attributes(persisted?: true, original_filename: filename)
      end

      it "links the upload to the font" do
        upload

        expect(font.stored_upload(filename)).to eq(upload)
      end

      it "doesn't store the same file twice" do
        upload

        expect { described_class.call(font:, filename:) }.not_to change { UploadReference.count }
      end
    end

    context "when the file can't be downloaded" do
      before { stub_font_file(file_url, status: 500) }

      it "returns nil and stores nothing" do
        expect { expect(upload).to be_nil }.not_to change { Upload.count }
      end

      it "doesn't try again during the retry delay" do
        upload
        stub_font_file(file_url)

        expect(described_class.call(font:, filename:)).to be_nil
      end

      it "tries again once the retry delay is over" do
        upload
        stub_font_file(file_url)
        Discourse.redis.del("bbcode-font-file-failed:inter:#{filename}")

        expect(described_class.call(font:, filename:)).to be_persisted
      end

      it "only holds back the file that failed" do
        upload
        other = "latin-ext-wght-normal.woff2"
        stub_font_file("#{FontsourceStubs::FILES_URL}/inter:vf@5.3.0/#{other}")

        expect(described_class.call(font:, filename: other)).to be_persisted
      end
    end

    context "when the filename is not a Fontsource file name" do
      let(:filename) { "../../etc-wght-normal.woff2" }

      it { is_expected.to be_nil }
    end
  end
end
