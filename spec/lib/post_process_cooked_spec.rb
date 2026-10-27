# frozen_string_literal: true

require_relative "../support/fontsource_stubs"

RSpec.describe "BBCode [font] post processing" do
  include FontsourceStubs

  fab!(:post) { Fabricate(:post, raw: "[font=Inter]x[/font]") }

  def process_post
    CookedPostProcessor.new(post).post_process
  end

  def import_job_font_ids
    Jobs::BbCode::ImportFont.jobs.map { |job| job["args"].first["font_id"] }
  end

  before do
    reset_font_list_cache
    stub_font_list
    SiteSetting.bbcode_enabled = true
    SiteSetting.bbcode_self_host_fonts = true
  end

  it "enqueues an import for a listed family that is not imported yet" do
    process_post

    expect(import_job_font_ids).to eq(["inter"])
  end

  it "enqueues nothing for a family that is already imported" do
    Fabricate(:bb_code_font)

    process_post

    expect(import_job_font_ids).to eq([])
  end

  it "enqueues nothing when self-hosting fonts is disabled" do
    SiteSetting.bbcode_self_host_fonts = false

    process_post

    expect(import_job_font_ids).to eq([])
  end

  it "enqueues nothing for a family Fontsource doesn't list" do
    post.update!(raw: "[font=Comic Neue Fancy]x[/font]")

    process_post

    expect(import_job_font_ids).to eq([])
  end
end
