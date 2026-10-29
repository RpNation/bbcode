# frozen_string_literal: true

RSpec.describe BbCode::Font::Action::DestroyUploads do
  describe ".call" do
    subject(:destroy_uploads) { described_class.call(references:) }

    fab!(:font, :bb_code_font)
    fab!(:other_font) { Fabricate(:bb_code_font, font_id: "other") }
    fab!(:upload)
    fab!(:kept_upload, :upload)

    let(:references) { UploadReference.where(target: font) }

    it "deletes the given references" do
      UploadReference.create!(target: font, upload:)

      expect { destroy_uploads }.to change { UploadReference.where(target: font).count }.from(1).to(
        0,
      )
    end

    it "destroys the uploads nothing refers to any more" do
      UploadReference.create!(target: font, upload:)

      expect { destroy_uploads }.to change { Upload.exists?(upload.id) }.from(true).to(false)
    end

    it "keeps an upload that another reference still refers to" do
      UploadReference.create!(target: font, upload:)
      other_reference = UploadReference.create!(target: other_font, upload:)

      destroy_uploads

      expect([Upload.exists?(upload.id), UploadReference.exists?(other_reference.id)]).to eq(
        [true, true],
      )
    end

    it "leaves the references and uploads outside the given ones alone" do
      UploadReference.create!(target: font, upload:)
      untouched = UploadReference.create!(target: other_font, upload: kept_upload)

      destroy_uploads

      expect([Upload.exists?(kept_upload.id), UploadReference.exists?(untouched.id)]).to eq(
        [true, true],
      )
    end

    it "does nothing when there are no references" do
      expect { destroy_uploads }.not_to change { [Upload.count, UploadReference.count] }
    end
  end
end
