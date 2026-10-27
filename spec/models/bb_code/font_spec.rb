# frozen_string_literal: true

RSpec.describe BbCode::Font do
  fab!(:font) { Fabricate(:bb_code_font) }

  describe "validations" do
    it "is valid with the fabricated defaults" do
      expect(font).to be_valid
    end

    it "requires a unique font id" do
      expect(Fabricate.build(:bb_code_font, font_id: font.font_id)).not_to be_valid
    end

    it "rejects font ids that are not lowercase, dash separated words" do
      invalid_ids = ["Inter", "open_sans", "-inter", "inter-", "in ter", "inter/../x"]

      expect(invalid_ids.reject { |id| Fabricate.build(:bb_code_font, font_id: id).valid? }).to eq(
        invalid_ids,
      )
    end

    it "accepts versions that start with a digit" do
      versions = %w[5.3.0 1 2.0.0-beta.1]

      expect(
        versions.select { |version| Fabricate.build(:bb_code_font, font_id: "x", version:).valid? },
      ).to eq(versions)
    end

    it "rejects versions that could alter a file url" do
      versions = ["v5.3.0", "5.3.0/../x", "5.3 0", ".5", ""]

      expect(
        versions.reject { |version| Fabricate.build(:bb_code_font, font_id: "x", version:).valid? },
      ).to eq(versions)
    end

    it "rejects a stylesheet that is too large" do
      font = Fabricate.build(:bb_code_font, css: "a" * (described_class::MAX_STYLESHEET_BYTES + 1))

      expect(font).not_to be_valid
    end
  end

  describe ".id_for" do
    it "converts family names to Fontsource ids" do
      names = ["Open Sans", "IBM Plex Sans", "  Roboto  ", "Noto Sans (JP)", "M PLUS 1p", "", nil]

      expect(names.map { |name| described_class.id_for(name) }).to eq(
        ["open-sans", "ibm-plex-sans", "roboto", "noto-sans-jp", "m-plus-1p", "", ""],
      )
    end
  end

  describe ".upload_target_types" do
    it "lists the target types of live and retired font files" do
      expect(described_class.upload_target_types).to contain_exactly(
        "BbCode::Font",
        described_class::RETIRED_TARGET_TYPE,
      )
    end
  end

  describe "#filenames" do
    it "lists the font files the stylesheet references" do
      expect(font.filenames).to eq(%w[latin-wght-normal.woff2 latin-ext-wght-normal.woff2])
    end

    it "lists each file once" do
      font.css = font.css + font.css

      expect(font.filenames).to eq(%w[latin-wght-normal.woff2 latin-ext-wght-normal.woff2])
    end
  end

  describe "#stored_upload" do
    fab!(:upload) do
      Fabricate(:upload).tap do |record|
        record.update_columns(original_filename: "latin-wght-normal.woff2")
      end
    end

    it "returns the linked upload with that filename" do
      UploadReference.create!(target: font, upload:)

      expect(font.stored_upload("latin-wght-normal.woff2")).to eq(upload)
    end

    it "returns nil when no upload with that filename is linked" do
      UploadReference.create!(target: font, upload:)

      expect(font.stored_upload("latin-ext-wght-normal.woff2")).to be_nil
    end

    it "ignores uploads linked to another font" do
      UploadReference.create!(target: Fabricate(:bb_code_font, font_id: "other"), upload:)

      expect(font.stored_upload("latin-wght-normal.woff2")).to be_nil
    end
  end

  describe "#stylesheet" do
    fab!(:upload) do
      Fabricate(:upload).tap do |record|
        record.update_columns(original_filename: "latin-wght-normal.woff2")
      end
    end

    it "keeps the route urls when no file is stored" do
      expect(font.stylesheet).to eq(font.css)
    end

    it "points stored files at their upload and the others at the route" do
      UploadReference.create!(target: font, upload:)

      expect(font.stylesheet.scan(/url\([^)]+\)/)).to eq(
        [
          "url(#{UrlHelper.cook_url(upload.url, secure: false)})",
          "url(/bbcode/fonts/inter/latin-ext-wght-normal.woff2)",
        ],
      )
    end

    it "prefixes the route urls with the base path on a subfolder install" do
      set_subfolder "/forum"

      expect(font.stylesheet.scan(/url\([^)]+\)/)).to eq(
        %w[
          url(/forum/bbcode/fonts/inter/latin-wght-normal.woff2)
          url(/forum/bbcode/fonts/inter/latin-ext-wght-normal.woff2)
        ],
      )
    end
  end

  describe "#touch_last_used" do
    it "updates last_used_at when it is older than a day" do
      font.update!(last_used_at: 2.days.ago)

      expect { font.touch_last_used }.to change { font.reload.last_used_at }.to be_within(
        5.seconds,
      ).of(Time.zone.now)
    end

    it "leaves last_used_at alone when it was updated within the last day" do
      recent = 2.hours.ago
      font.update!(last_used_at: recent)

      expect { font.touch_last_used }.not_to change { font.reload.last_used_at }
    end
  end

  describe ".idle and #idle?" do
    before do
      freeze_time Time.utc(2026, 1, 15)
      SiteSetting.bbcode_font_evict_idle_days = 10
    end

    it "treats a font as idle only once it was last used before the cutoff" do
      just_inside =
        Fabricate(:bb_code_font, font_id: "inside", last_used_at: 10.days.ago + 1.second)
      at_cutoff = Fabricate(:bb_code_font, font_id: "cutoff", last_used_at: 10.days.ago)
      just_outside =
        Fabricate(:bb_code_font, font_id: "outside", last_used_at: 10.days.ago - 1.second)

      expect([just_inside, at_cutoff, just_outside].map(&:idle?)).to eq([false, false, true])
    end

    it "selects the same fonts as #idle?" do
      Fabricate(:bb_code_font, font_id: "inside", last_used_at: 10.days.ago + 1.second)
      just_outside =
        Fabricate(:bb_code_font, font_id: "outside", last_used_at: 10.days.ago - 1.second)

      expect(described_class.idle).to contain_exactly(just_outside)
    end

    it "follows the setting" do
      font.update!(last_used_at: 5.days.ago)

      expect { SiteSetting.bbcode_font_evict_idle_days = 4 }.to change { font.idle? }.from(
        false,
      ).to(true)
    end
  end

  describe "#revalidation_due?" do
    before do
      freeze_time Time.utc(2026, 1, 15)
      SiteSetting.bbcode_font_revalidate_days = 7
    end

    it "is due only once it was checked before the configured number of days ago" do
      just_inside = Fabricate.build(:bb_code_font, checked_at: 7.days.ago + 1.second)
      at_cutoff = Fabricate.build(:bb_code_font, checked_at: 7.days.ago)
      just_outside = Fabricate.build(:bb_code_font, checked_at: 7.days.ago - 1.second)

      expect([just_inside, at_cutoff, just_outside].map(&:revalidation_due?)).to eq(
        [false, false, true],
      )
    end

    it "follows the setting" do
      font.update!(checked_at: 5.days.ago)

      expect { SiteSetting.bbcode_font_revalidate_days = 4 }.to change {
        font.revalidation_due?
      }.from(false).to(true)
    end
  end

  describe "#all_upload_references" do
    fab!(:other_font) { Fabricate(:bb_code_font, font_id: "other") }
    fab!(:live_upload) { Fabricate(:upload) }
    fab!(:retired_upload) { Fabricate(:upload) }
    fab!(:other_upload) { Fabricate(:upload) }

    it "returns the live and retired references of the font only" do
      live = UploadReference.create!(target: font, upload: live_upload)
      retired =
        UploadReference.create!(
          target_type: described_class::RETIRED_TARGET_TYPE,
          target_id: font.id,
          upload: retired_upload,
        )
      UploadReference.create!(target: other_font, upload: other_upload)
      UploadReference.create!(
        target_type: described_class::RETIRED_TARGET_TYPE,
        target_id: other_font.id,
        upload: other_upload,
      )

      expect(font.all_upload_references).to contain_exactly(live, retired)
    end
  end

  describe ".retired_references_past_grace" do
    fab!(:upload)

    def retired_reference(updated_at:)
      reference =
        UploadReference.create!(
          target_type: described_class::RETIRED_TARGET_TYPE,
          target_id: font.id,
          upload: Fabricate(:upload),
        )
      reference.update_columns(updated_at:)
      reference
    end

    it "returns retired references that weren't updated within the grace period" do
      freeze_time Time.utc(2026, 1, 15)
      just_inside = retired_reference(updated_at: 15.days.ago + 1.minute)
      just_outside = retired_reference(updated_at: 15.days.ago - 1.minute)

      expect(described_class.retired_references_past_grace).to contain_exactly(just_outside)
      expect(just_inside).to be_persisted
    end

    it "doesn't return live references however old they are" do
      live = UploadReference.create!(target: font, upload:)
      live.update_columns(updated_at: 1.year.ago)

      expect(described_class.retired_references_past_grace).to be_empty
    end
  end

  describe "#retire_stored_files" do
    fab!(:other_font) { Fabricate(:bb_code_font, font_id: "other") }
    fab!(:upload)
    fab!(:other_upload) { Fabricate(:upload) }

    def retired_references_of(record)
      UploadReference.where(target_type: described_class::RETIRED_TARGET_TYPE, target_id: record.id)
    end

    def live_references_of(record)
      UploadReference.where(target_type: described_class.polymorphic_name, target_id: record.id)
    end

    it "turns the live links into retired links for the same uploads" do
      UploadReference.create!(target: font, upload:)

      font.retire_stored_files

      expect(retired_references_of(font).pluck(:upload_id)).to eq([upload.id])
      expect(live_references_of(font)).to be_empty
    end

    it "refreshes the time of the links so the grace period starts then" do
      reference = UploadReference.create!(target: font, upload:)
      reference.update_columns(updated_at: 1.year.ago)
      freeze_time Time.utc(2026, 1, 15)

      font.retire_stored_files

      expect(retired_references_of(font).first.updated_at).to eq_time(Time.zone.now)
    end

    it "no longer lists the files as stored" do
      UploadReference.create!(target: font, upload:)

      expect { font.retire_stored_files }.to change { font.reload.uploads.count }.from(1).to(0)
    end

    it "leaves the state of the font itself as it was" do
      UploadReference.create!(target: font, upload:)

      expect { font.retire_stored_files }.not_to change { font.reload.attributes }
    end

    it "leaves the references of other fonts alone" do
      other_live = UploadReference.create!(target: other_font, upload: other_upload)
      UploadReference.create!(target: font, upload:)

      font.retire_stored_files

      expect(live_references_of(other_font)).to contain_exactly(other_live)
      expect(retired_references_of(other_font)).to be_empty
    end

    it "doesn't touch the upload records" do
      UploadReference.create!(target: font, upload:)

      expect { font.retire_stored_files }.not_to change { Upload.count }
    end

    context "when an upload is both live and already retired for the font" do
      before do
        UploadReference.create!(
          target_type: described_class::RETIRED_TARGET_TYPE,
          target_id: font.id,
          upload:,
        ).update_columns(updated_at: 10.days.ago)
        UploadReference.create!(target: font, upload:)
        freeze_time
      end

      it "doesn't violate the unique index" do
        expect { font.retire_stored_files }.not_to raise_error
      end

      it "leaves exactly one retired link and no live link" do
        font.retire_stored_files

        expect(retired_references_of(font).pluck(:upload_id)).to eq([upload.id])
        expect(live_references_of(font)).to be_empty
      end

      it "refreshes the time of the retired link" do
        font.retire_stored_files

        expect(retired_references_of(font).first.updated_at).to eq_time(Time.zone.now)
      end
    end
  end
end
