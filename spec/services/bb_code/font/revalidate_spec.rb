# frozen_string_literal: true

require_relative "../../../support/fontsource_stubs"

RSpec.describe BbCode::Font::Revalidate do
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

    fab!(:font) do
      Fabricate(:bb_code_font, version: "5.3.0", checked_at: 31.days.ago, last_used_at: 3.days.ago)
    end

    let(:params) { { font_id: } }
    let(:dependencies) { {} }
    let(:font_id) { "inter" }
    let(:published_version) { "5.3.0" }
    let(:metadata) { fontsource_metadata(version: published_version, weights: [400]) }

    before { stub_family(metadata) }

    context "when the contract is invalid" do
      let(:font_id) { "Not A Font" }

      it { is_expected.to fail_a_contract }
    end

    context "when the font is not imported" do
      let(:font_id) { "roboto" }

      it { is_expected.to fail_to_find_a_model(:font) }
    end

    context "when the font was checked recently" do
      before { font.update!(checked_at: 1.day.ago) }

      it { is_expected.to fail_a_policy(:due_for_revalidation) }

      it "doesn't ask Fontsource about the family" do
        result

        expect(a_request(:get, %r{api\.fontsource\.org/v1})).not_to have_been_made
      end
    end

    context "when forced and the font was checked recently" do
      fab!(:upload) do
        Fabricate(:upload).tap do |record|
          record.update_columns(original_filename: "latin-wght-normal.woff2")
        end
      end

      let(:dependencies) { { options: { force: true } } }
      let(:published_version) { "5.4.0" }

      before do
        font.update!(checked_at: 1.day.ago)
        UploadReference.create!(target: font, upload:)
      end

      it { is_expected.to run_successfully }

      it "records that the version was checked" do
        freeze_time

        expect { result }.to change { font.reload.checked_at }.to eq_time(Time.zone.now)
      end

      it "stores the new version" do
        expect { result }.to change { font.reload.version }.from("5.3.0").to("5.4.0")
      end

      it "retires the stored files" do
        expect { result }.to change { font.reload.uploads.to_a }.from([upload]).to([])
      end
    end

    context "when the revalidation interval setting is shortened" do
      before do
        font.update!(checked_at: 10.days.ago)
        SiteSetting.bbcode_font_revalidate_days = 7
      end

      it { is_expected.to run_successfully }
    end

    context "when Fontsource can't provide the family" do
      before do
        stub_request(:get, "#{FontsourceStubs::API_URL}/v1/fonts/inter").to_return(status: 500)
      end

      it { is_expected.to fail_to_find_a_model(:family) }

      it "leaves the font as it was" do
        expect { result }.not_to change { font.reload.attributes }
      end
    end

    context "when the published version is the stored one" do
      fab!(:upload) do
        Fabricate(:upload).tap do |record|
          record.update_columns(original_filename: "latin-wght-normal.woff2")
        end
      end

      before { UploadReference.create!(target: font, upload:) }

      it { is_expected.to run_successfully }

      it "records that the version was checked" do
        freeze_time

        expect { result }.to change { font.reload.checked_at }.to eq_time(Time.zone.now)
      end

      it "leaves the version and the stylesheet as they were" do
        expect { result }.not_to change { font.reload.slice(:version, :css) }
      end

      it "keeps the stored files live" do
        result

        expect(font.reload.uploads).to contain_exactly(upload)
      end

      it "leaves last_used_at as it was" do
        expect { result }.not_to change { font.reload.last_used_at }
      end
    end

    context "when a new version is published" do
      fab!(:upload) do
        Fabricate(:upload).tap do |record|
          record.update_columns(original_filename: "latin-wght-normal.woff2")
        end
      end

      let(:published_version) { "5.4.0" }

      before { UploadReference.create!(target: font, upload:) }

      it { is_expected.to run_successfully }

      it "stores the new version" do
        expect { result }.to change { font.reload.version }.from("5.3.0").to("5.4.0")
      end

      it "generates the stylesheet again from the new metadata" do
        stub_family(metadata, axes: fontsource_axes(min: 200, max: 800))

        expect { result }.to change { font.reload.css.scan(/font-weight: [^;]+/).uniq }.from(
          ["font-weight: 100 900"],
        ).to(["font-weight: 200 800"])
      end

      it "records that the version was checked" do
        freeze_time

        expect { result }.to change { font.reload.checked_at }.to eq_time(Time.zone.now)
      end

      it "retires the stored files instead of deleting them" do
        result

        expect(font.all_upload_references.pluck(:target_type, :upload_id)).to eq(
          [[BbCode::Font::RETIRED_TARGET_TYPE, upload.id]],
        )
      end

      it "stops serving the retired files" do
        expect { result }.to change { font.reload.uploads.to_a }.from([upload]).to([])
      end

      it "leaves last_used_at as it was" do
        expect { result }.not_to change { font.reload.last_used_at }
      end

      context "when the regenerated stylesheet is invalid" do
        let(:metadata) do
          fontsource_metadata(
            version: published_version,
            variable: false,
            weights: (1..5000).to_a,
            ranges: {
              "latin" => FontsourceStubs::LATIN_RANGE,
            },
          )
        end

        before { stub_family(metadata, axes: nil) }

        it { is_expected.to fail_a_step(:refresh_stylesheet) }

        it "leaves the version and the stylesheet as they were" do
          expect { result }.not_to change { font.reload.slice(:version, :css, :checked_at) }
        end

        it "keeps the stored files live" do
          result

          expect(font.reload.uploads).to contain_exactly(upload)
        end
      end
    end
  end
end
