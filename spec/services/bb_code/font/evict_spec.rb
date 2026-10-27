# frozen_string_literal: true

RSpec.describe BbCode::Font::Evict do
  describe described_class::Contract, type: :model do
    it { is_expected.to validate_presence_of(:font_id) }
    it { is_expected.to allow_values("inter", "open-sans", "m-plus-1p").for(:font_id) }
    it do
      is_expected.not_to allow_values("Inter", "open_sans", "-inter", "inter-", "a b").for(:font_id)
    end
  end

  describe ".call" do
    subject(:result) { described_class.call(params:, **dependencies) }

    fab!(:font) { Fabricate(:bb_code_font, last_used_at: 120.days.ago) }

    let(:params) { { font_id: } }
    let(:dependencies) { {} }
    let(:font_id) { "inter" }

    context "when the contract is invalid" do
      let(:font_id) { "Not A Font" }

      it { is_expected.to fail_a_contract }
    end

    context "when the font is not imported" do
      let(:font_id) { "roboto" }

      it { is_expected.to fail_to_find_a_model(:font) }
    end

    context "when the font was used recently" do
      before { font.update!(last_used_at: 1.day.ago) }

      it { is_expected.to fail_a_policy(:idle_for_too_long) }

      it "keeps the font" do
        expect { result }.not_to change { BbCode::Font.exists?(font.id) }
      end
    end

    context "when forced and the font was used recently" do
      fab!(:upload) { Fabricate(:upload) }

      let(:dependencies) { { options: { force: true } } }

      before do
        font.update!(last_used_at: 1.day.ago)
        UploadReference.create!(target: font, upload:)
      end

      it { is_expected.to run_successfully }

      it "deletes the font" do
        expect { result }.to change { BbCode::Font.exists?(font.id) }.from(true).to(false)
      end

      it "destroys its files" do
        expect { result }.to change { Upload.exists?(upload.id) }.from(true).to(false)
      end
    end

    context "when the idle period setting is shortened" do
      before do
        font.update!(last_used_at: 20.days.ago)
        SiteSetting.bbcode_font_evict_idle_days = 10
      end

      it { is_expected.to run_successfully }
    end

    context "when the font is idle" do
      fab!(:live_upload) { Fabricate(:upload) }
      fab!(:retired_upload) { Fabricate(:upload) }
      fab!(:shared_upload) { Fabricate(:upload) }
      fab!(:other_font) { Fabricate(:bb_code_font, font_id: "other") }

      before do
        UploadReference.create!(target: font, upload: live_upload)
        UploadReference.create!(
          target_type: BbCode::Font::RETIRED_TARGET_TYPE,
          target_id: font.id,
          upload: retired_upload,
        )
        UploadReference.create!(target: font, upload: shared_upload)
        UploadReference.create!(target: other_font, upload: shared_upload)
      end

      it { is_expected.to run_successfully }

      it "deletes the font" do
        expect { result }.to change { BbCode::Font.exists?(font.id) }.from(true).to(false)
      end

      it "deletes its live and retired references" do
        result

        expect(
          UploadReference.where(
            target_type: [BbCode::Font.polymorphic_name, BbCode::Font::RETIRED_TARGET_TYPE],
            target_id: font.id,
          ),
        ).to be_empty
      end

      it "destroys the uploads nothing else refers to" do
        result

        expect(Upload.where(id: [live_upload.id, retired_upload.id])).to be_empty
      end

      it "keeps an upload that another font still refers to" do
        result

        expect(other_font.reload.uploads).to contain_exactly(shared_upload)
      end

      it "leaves other fonts alone" do
        expect { result }.not_to change { other_font.reload.attributes }
      end
    end
  end
end
