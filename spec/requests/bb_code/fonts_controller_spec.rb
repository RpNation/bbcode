# frozen_string_literal: true

require_relative "../../support/fontsource_stubs"

RSpec.describe BbCode::FontsController do
  include FontsourceStubs

  def cache_directives
    response.headers["Cache-Control"].split(", ")
  end

  def import_job_font_ids
    Jobs::BbCode::ImportFont.jobs.map { |job| job["args"].first["font_id"] }
  end

  def revalidation_job_font_ids
    Jobs::BbCode::RevalidateFont.jobs.map { |job| job["args"].first["font_id"] }
  end

  before do
    SiteSetting.bbcode_self_host_fonts = true
    reset_font_list_cache
  end

  context "when self-hosting fonts is disabled" do
    before { SiteSetting.bbcode_self_host_fonts = false }

    it "responds with 404 to both routes" do
      Fabricate(:bb_code_font)

      get "/bbcode/fonts/inter.css"
      stylesheet_status = response.status
      get "/bbcode/fonts/inter/latin-wght-normal.woff2"

      expect([stylesheet_status, response.status]).to eq([404, 404])
    end
  end

  context "when the plugin is disabled" do
    before { SiteSetting.bbcode_enabled = false }

    it "responds with 404 to both routes" do
      Fabricate(:bb_code_font)

      get "/bbcode/fonts/inter.css"
      stylesheet_status = response.status
      get "/bbcode/fonts/inter/latin-wght-normal.woff2"

      expect([stylesheet_status, response.status]).to eq([404, 404])
    end
  end

  describe "#stylesheet" do
    fab!(:font) { Fabricate(:bb_code_font) }

    it "serves the stylesheet as CSS" do
      get "/bbcode/fonts/inter.css"

      expect(response.status).to eq(200)
      expect(response.media_type).to eq("text/css")
      expect(response.body).to eq(font.stylesheet)
    end

    it "can be cached publicly by browsers and shared caches" do
      get "/bbcode/fonts/inter.css"

      expect(cache_directives).to contain_exactly(
        "public",
        "max-age=3600",
        "s-maxage=86400",
        "stale-while-revalidate=604800",
      )
    end

    it "allows any origin to use the stylesheet" do
      get "/bbcode/fonts/inter.css"

      expect(response.headers["Access-Control-Allow-Origin"]).to eq("*")
    end

    it "doesn't set cookies" do
      get "/bbcode/fonts/inter.css"

      expect(response.headers["Set-Cookie"]).to be_nil
    end

    it "records that the font is in use" do
      font.update!(last_used_at: 2.days.ago)

      expect { get "/bbcode/fonts/inter.css" }.to change { font.reload.last_used_at }.to be_within(
        5.seconds,
      ).of(Time.zone.now)
    end

    it "points stored files at their uploads" do
      upload = Fabricate(:upload)
      upload.update_columns(original_filename: "latin-wght-normal.woff2")
      UploadReference.create!(target: font, upload:)

      get "/bbcode/fonts/inter.css"

      expect(response.body).to include("url(#{UrlHelper.cook_url(upload.url, secure: false)})")
    end

    context "when the font is due for revalidation" do
      before { font.update!(checked_at: 31.days.ago) }

      it "still serves the current stylesheet" do
        get "/bbcode/fonts/inter.css"

        expect(response.status).to eq(200)
        expect(response.body).to eq(font.stylesheet)
      end

      it "enqueues a revalidation only for the first request" do
        2.times { get "/bbcode/fonts/inter.css" }

        expect(revalidation_job_font_ids).to eq(["inter"])
      end
    end

    context "when the font is not due for revalidation" do
      it "doesn't enqueue a revalidation" do
        get "/bbcode/fonts/inter.css"

        expect(revalidation_job_font_ids).to eq([])
      end
    end

    context "when the family is not a known Google font" do
      before { stub_font_list }

      it "responds with 404 that shared caches keep for a day" do
        get "/bbcode/fonts/unknown.css"

        expect(response.status).to eq(404)
        expect(cache_directives).to contain_exactly("public", "max-age=86400", "s-maxage=86400")
      end

      it "doesn't enqueue an import" do
        get "/bbcode/fonts/unknown.css"

        expect(import_job_font_ids).to eq([])
      end
    end

    context "when the family is listed but not imported yet" do
      before { stub_font_list({ "inter" => "google", "roboto" => "google" }) }

      it "responds with 404 that shared caches keep for a minute" do
        get "/bbcode/fonts/roboto.css"

        expect(response.status).to eq(404)
        expect(cache_directives).to contain_exactly("public", "max-age=60", "s-maxage=60")
      end

      it "enqueues an import only for the first request" do
        2.times { get "/bbcode/fonts/roboto.css" }

        expect(import_job_font_ids).to eq(["roboto"])
      end
    end

    context "when Fontsource can't be reached" do
      before { stub_request(:get, "#{FontsourceStubs::API_URL}/fontlist").to_return(status: 500) }

      it "responds with 404 that shared caches keep for a minute" do
        get "/bbcode/fonts/roboto.css"

        expect(response.status).to eq(404)
        expect(cache_directives).to contain_exactly("public", "max-age=60", "s-maxage=60")
      end

      it "doesn't enqueue an import" do
        get "/bbcode/fonts/roboto.css"

        expect(import_job_font_ids).to eq([])
      end
    end
  end

  describe "#file" do
    fab!(:font) { Fabricate(:bb_code_font, version: "5.3.0") }

    let(:file_url) { "#{FontsourceStubs::FILES_URL}/inter:vf@5.3.0/latin-wght-normal.woff2" }

    context "when the file is already stored" do
      fab!(:upload) do
        Fabricate(:upload).tap do |record|
          record.update_columns(original_filename: "latin-wght-normal.woff2")
        end
      end

      before { UploadReference.create!(target: font, upload:) }

      it "redirects to the upload" do
        get "/bbcode/fonts/inter/latin-wght-normal.woff2"

        expect(response).to redirect_to(UrlHelper.cook_url(upload.url, secure: false))
      end

      it "can be cached publicly for a week by shared caches" do
        get "/bbcode/fonts/inter/latin-wght-normal.woff2"

        expect(cache_directives).to contain_exactly(
          "public",
          "max-age=86400",
          "s-maxage=604800",
          "stale-while-revalidate=604800",
        )
      end

      it "allows any origin and doesn't set cookies" do
        get "/bbcode/fonts/inter/latin-wght-normal.woff2"

        expect(response.headers.values_at("Access-Control-Allow-Origin", "Set-Cookie")).to eq(
          ["*", nil],
        )
      end
    end

    context "when the file is not stored yet" do
      before { stub_font_file(file_url) }

      it "downloads the file and redirects to the new upload" do
        get "/bbcode/fonts/inter/latin-wght-normal.woff2"

        expect(response).to redirect_to(
          UrlHelper.cook_url(font.stored_upload("latin-wght-normal.woff2").url, secure: false),
        )
      end
    end

    context "when the file can't be downloaded" do
      before { stub_font_file(file_url, status: 500) }

      it "responds with 404 that shared caches keep for a minute" do
        get "/bbcode/fonts/inter/latin-wght-normal.woff2"

        expect(response.status).to eq(404)
        expect(cache_directives).to contain_exactly("public", "max-age=60", "s-maxage=60")
      end
    end

    context "when the font doesn't use the file" do
      it "responds with 404 without fetching anything" do
        get "/bbcode/fonts/inter/cyrillic-wght-normal.woff2"

        expect(response.status).to eq(404)
        expect(a_request(:get, /jsdelivr/)).not_to have_been_made
      end
    end

    context "when the font is not imported" do
      it "responds with 404" do
        get "/bbcode/fonts/roboto/latin-wght-normal.woff2"

        expect(response.status).to eq(404)
      end
    end
  end
end
