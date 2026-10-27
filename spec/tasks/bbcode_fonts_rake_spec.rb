# frozen_string_literal: true

require "rake"
require_relative "../support/fontsource_stubs"

# rubocop:disable RSpec/DescribeClass
RSpec.describe "bbcode:fonts rake tasks" do
  include FontsourceStubs

  before do
    Rake::Task.clear
    Discourse::Application.load_tasks
    @original_rails_db = ENV["RAILS_DB"]
    ENV["RAILS_DB"] = "default"
  end

  after { ENV["RAILS_DB"] = @original_rails_db }

  def store_file(font, filename:, filesize:, retired: false)
    upload = Fabricate(:upload)
    upload.update_columns(original_filename: filename, filesize:)
    target_type = retired ? BbCode::Font::RETIRED_TARGET_TYPE : BbCode::Font.polymorphic_name
    UploadReference.create!(target_type:, target_id: font.id, upload:)
    upload
  end

  it "defines each task once" do
    expect(Rake::Task["bbcode:fonts:list"].actions.size).to eq(1)
  end

  describe "bbcode:fonts:list" do
    it "says so when no fonts are stored" do
      expect { invoke_rake_task("bbcode:fonts:list") }.to output(
        /BBCode fonts on default\nNo fonts are stored\./,
      ).to_stdout
    end

    context "with stored fonts" do
      fab!(:fresh_font) do
        Fabricate(
          :bb_code_font,
          font_id: "inter",
          version: "5.3.0",
          checked_at: Time.zone.now,
          last_used_at: Time.zone.now,
        )
      end
      fab!(:stale_font) do
        Fabricate(
          :bb_code_font,
          font_id: "roboto",
          version: "2.1.0",
          checked_at: 40.days.ago,
          last_used_at: 200.days.ago,
        )
      end

      before do
        store_file(fresh_font, filename: "a.woff2", filesize: 1024)
        store_file(fresh_font, filename: "b.woff2", filesize: 1024, retired: true)
        store_file(stale_font, filename: "c.woff2", filesize: 2048)
      end

      def listing
        capture_stdout { invoke_rake_task("bbcode:fonts:list") }
      end

      it "shows the version, file count and size of a font, retired files included" do
        expect(listing).to match(/^inter\s+5\.3\.0\s+2\s+2 KB\s+today\s+today\s*$/)
      end

      it "shows when a font is due for a check and idle" do
        expect(listing).to match(/^roboto\s+2\.1\.0\s+1\s+2 KB\s+200d ago\s+40d ago\s+due,idle$/)
      end

      it "ends with the totals" do
        expect(listing).to include("2 fonts, 3 files, 4 KB")
      end

      it "uses the singular in the totals" do
        stale_font.destroy!
        UploadReference.where(target_type: BbCode::Font::RETIRED_TARGET_TYPE).delete_all

        expect(listing).to include("1 font, 1 file, 1 KB")
      end
    end
  end

  describe "bbcode:fonts:refresh" do
    fab!(:font) do
      Fabricate(:bb_code_font, version: "5.3.0", checked_at: 1.day.ago, last_used_at: 1.day.ago)
    end

    let(:published_version) { "5.4.0" }

    before do
      reset_font_list_cache
      stub_family(fontsource_metadata(version: published_version, weights: [400]))
    end

    it "revalidates a font that has a newer version" do
      expect { invoke_rake_task("bbcode:fonts:refresh", "inter") }.to output(
        /inter: 5\.3\.0 -> 5\.4\.0/,
      ).to_stdout
    end

    it "stores the newer version" do
      expect { capture_stdout { invoke_rake_task("bbcode:fonts:refresh", "inter") } }.to change {
        font.reload.version
      }.from("5.3.0").to("5.4.0")
    end

    context "when the font is up to date" do
      let(:published_version) { "5.3.0" }

      it "reports it even though it was not due" do
        expect { invoke_rake_task("bbcode:fonts:refresh", "inter") }.to output(
          /inter: up to date \(5\.3\.0\)/,
        ).to_stdout
      end

      it "records the check" do
        freeze_time

        expect { capture_stdout { invoke_rake_task("bbcode:fonts:refresh", "inter") } }.to change {
          font.reload.checked_at
        }.to eq_time(Time.zone.now)
      end
    end

    context "when Fontsource is unreachable" do
      before do
        stub_request(:get, "#{FontsourceStubs::API_URL}/v1/fonts/inter").to_return(status: 500)
      end

      it "reports the failure" do
        expect { invoke_rake_task("bbcode:fonts:refresh", "inter") }.to output(
          /inter: FAILED/,
        ).to_stdout
      end

      it "leaves the font as it was" do
        expect {
          capture_stdout { invoke_rake_task("bbcode:fonts:refresh", "inter") }
        }.not_to change { font.reload.attributes }
      end
    end

    it "refreshes every stored font when no id is given" do
      expect { invoke_rake_task("bbcode:fonts:refresh") }.to output(
        /inter: 5\.3\.0 -> 5\.4\.0/,
      ).to_stdout
    end
  end

  describe "bbcode:fonts:purge" do
    fab!(:font) { Fabricate(:bb_code_font, font_id: "inter", last_used_at: 1.day.ago) }
    fab!(:other_font) { Fabricate(:bb_code_font, font_id: "roboto", last_used_at: 1.day.ago) }

    let!(:upload) { store_file(font, filename: "a.woff2", filesize: 10) }
    let!(:retired_upload) { store_file(font, filename: "b.woff2", filesize: 10, retired: true) }
    let!(:other_upload) { store_file(other_font, filename: "c.woff2", filesize: 10) }

    it "deletes the given font even though it is not idle" do
      expect { invoke_rake_task("bbcode:fonts:purge", "inter") }.to output(
        /inter: deleted/,
      ).to_stdout
      expect(BbCode::Font.exists?(font.id)).to eq(false)
    end

    it "deletes its references" do
      capture_stdout { invoke_rake_task("bbcode:fonts:purge", "inter") }

      expect(font.all_upload_references).to be_empty
    end

    it "destroys the uploads nothing refers to any more" do
      capture_stdout { invoke_rake_task("bbcode:fonts:purge", "inter") }

      expect(Upload.where(id: [upload.id, retired_upload.id])).to be_empty
    end

    it "leaves the other fonts and their files" do
      capture_stdout { invoke_rake_task("bbcode:fonts:purge", "inter") }

      expect(other_font.reload.uploads).to contain_exactly(other_upload)
    end

    it "deletes every font when no id is given" do
      capture_stdout { invoke_rake_task("bbcode:fonts:purge") }

      expect(BbCode::Font.count).to eq(0)
    end
  end

  %w[refresh purge].each do |task|
    describe "bbcode:fonts:#{task} without a matching font" do
      it "says so for an unknown font" do
        Fabricate(:bb_code_font)

        expect { invoke_rake_task("bbcode:fonts:#{task}", "nope") }.to output(
          /No stored font named 'nope'\./,
        ).to_stdout
      end

      it "says so when nothing is stored" do
        expect { invoke_rake_task("bbcode:fonts:#{task}") }.to output(
          /No fonts are stored\./,
        ).to_stdout
      end
    end
  end
end
