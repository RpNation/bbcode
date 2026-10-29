# frozen_string_literal: true

RSpec.describe Jobs::BbCode::CleanUpFonts do
  describe "#execute" do
    fab!(:idle_font) { Fabricate(:bb_code_font, font_id: "idle", last_used_at: 100.days.ago) }
    fab!(:active_font) { Fabricate(:bb_code_font, font_id: "active", last_used_at: 1.day.ago) }

    def retired_reference(font, updated_at:)
      reference =
        UploadReference.create!(
          target_type: BbCode::Font::RETIRED_TARGET_TYPE,
          target_id: font.id,
          upload: Fabricate(:upload),
        )
      reference.update_columns(updated_at:)
      reference
    end

    it "evicts every idle font and keeps the others" do
      other_idle_font = Fabricate(:bb_code_font, font_id: "also-idle", last_used_at: 200.days.ago)

      described_class.new.execute({})

      expect(BbCode::Font.pluck(:font_id)).to contain_exactly(active_font.font_id)
      expect(BbCode::Font.exists?(other_idle_font.id)).to eq(false)
    end

    it "destroys the files of an evicted font" do
      upload = Fabricate(:upload)
      UploadReference.create!(target: idle_font, upload:)

      expect { described_class.new.execute({}) }.to change { Upload.exists?(upload.id) }.from(
        true,
      ).to(false)
    end

    it "follows the idle period setting" do
      active_font.update!(last_used_at: 20.days.ago)
      SiteSetting.bbcode_font_evict_idle_days = 10

      described_class.new.execute({})

      expect(BbCode::Font.pluck(:font_id)).to be_empty
    end

    it "destroys retired files once the grace period has passed" do
      expired = retired_reference(active_font, updated_at: 16.days.ago)

      described_class.new.execute({})

      expect([UploadReference.exists?(expired.id), Upload.exists?(expired.upload_id)]).to eq(
        [false, false],
      )
    end

    it "keeps retired files that are still within the grace period" do
      recent = retired_reference(active_font, updated_at: 14.days.ago)

      described_class.new.execute({})

      expect([UploadReference.exists?(recent.id), Upload.exists?(recent.upload_id)]).to eq(
        [true, true],
      )
    end

    it "keeps the live files of fonts that are in use" do
      upload = Fabricate(:upload)
      live = UploadReference.create!(target: active_font, upload:)
      live.update_columns(updated_at: 1.year.ago)

      described_class.new.execute({})

      expect([UploadReference.exists?(live.id), Upload.exists?(upload.id)]).to eq([true, true])
    end

    it "does nothing when the plugin is disabled" do
      SiteSetting.bbcode_enabled = false
      expired = retired_reference(active_font, updated_at: 16.days.ago)

      expect { described_class.new.execute({}) }.not_to change {
        [BbCode::Font.count, UploadReference.exists?(expired.id)]
      }
    end
  end
end
