# frozen_string_literal: true

require_relative "../../../support/fontsource_stubs"

RSpec.describe BbCode::Fontsource::Family do
  include FontsourceStubs

  def build_family(metadata, variable:, axes: fontsource_axes)
    described_class.new(metadata:, axes:, variable:)
  end

  def face_summaries(family)
    family.faces.map { |face| [face.weight, face.style, face.filename] }
  end

  describe "#faces" do
    it "has one face per subset and style, covering the weight range, for a variable family" do
      metadata = fontsource_metadata(weights: [400, 700], styles: %w[normal italic])

      expect(face_summaries(build_family(metadata, variable: true))).to eq(
        [
          ["100 900", "normal", "latin-wght-normal.woff2"],
          ["100 900", "normal", "latin-ext-wght-normal.woff2"],
          ["100 900", "italic", "latin-wght-italic.woff2"],
          ["100 900", "italic", "latin-ext-wght-italic.woff2"],
        ],
      )
    end

    it "has one face per weight, style and subset for a static family" do
      metadata =
        fontsource_metadata(variable: false, weights: [400, 700], styles: %w[normal italic])

      expect(face_summaries(build_family(metadata, variable: false, axes: {}))).to eq(
        [
          %w[400 normal latin-400-normal.woff2],
          %w[400 normal latin-ext-400-normal.woff2],
          %w[400 italic latin-400-italic.woff2],
          %w[400 italic latin-ext-400-italic.woff2],
          %w[700 normal latin-700-normal.woff2],
          %w[700 normal latin-ext-700-normal.woff2],
          %w[700 italic latin-700-italic.woff2],
          %w[700 italic latin-ext-700-italic.woff2],
        ],
      )
    end

    it "carries the unicode range of each subset" do
      family = build_family(fontsource_metadata, variable: true)

      expect(family.faces.map(&:unicode_range)).to eq(
        [FontsourceStubs::LATIN_RANGE, FontsourceStubs::LATIN_EXT_RANGE],
      )
    end

    it "skips files without a unicode range" do
      metadata =
        fontsource_metadata(
          variable: false,
          weights: [400],
          ranges: {
            "latin" => FontsourceStubs::LATIN_RANGE,
          },
          file_keys: %w[latin japanese],
        )

      expect(face_summaries(build_family(metadata, variable: false, axes: {}))).to eq(
        [%w[400 normal latin-400-normal.woff2]],
      )
    end

    it "matches numbered slices keyed as [n] in the unicode ranges" do
      metadata =
        fontsource_metadata(
          variable: false,
          weights: [400],
          ranges: {
            "[0]" => "U+0020-007E",
            "[1]" => "U+3000-3003",
          },
          file_keys: %w[0 1 japanese],
        )

      expect(face_summaries(build_family(metadata, variable: false, axes: {}))).to eq(
        [%w[400 normal 0-400-normal.woff2], %w[400 normal 1-400-normal.woff2]],
      )
    end

    it "skips faces with a malformed unicode range" do
      metadata =
        fontsource_metadata(
          variable: false,
          weights: [400],
          ranges: {
            "latin" => "U+0000-00FF}body{x:y",
            "latin-ext" => FontsourceStubs::LATIN_EXT_RANGE,
          },
        )

      expect(face_summaries(build_family(metadata, variable: false, axes: {}))).to eq(
        [%w[400 normal latin-ext-400-normal.woff2]],
      )
    end

    it "skips faces with a malformed weight" do
      metadata = fontsource_metadata(variable: false, weights: [400])
      metadata["variants"]["400;color:red"] = metadata["variants"]["400"]

      expect(face_summaries(build_family(metadata, variable: false, axes: {})).map(&:first)).to all(
        eq("400"),
      )
    end

    it "skips faces with an unknown style" do
      metadata = fontsource_metadata(variable: false, weights: [400], styles: %w[normal oblique])

      expect(
        face_summaries(build_family(metadata, variable: false, axes: {})).map(&:second),
      ).to all(eq("normal"))
    end

    it "skips faces whose filename is not well formed" do
      metadata =
        fontsource_metadata(
          variable: false,
          weights: [400],
          ranges: {
            "latin" => FontsourceStubs::LATIN_RANGE,
            "La tin" => FontsourceStubs::LATIN_RANGE,
          },
        )

      expect(face_summaries(build_family(metadata, variable: false, axes: {}))).to eq(
        [%w[400 normal latin-400-normal.woff2]],
      )
    end
  end

  describe "#variable?" do
    it "is true for a variable family with a weight axis" do
      expect(build_family(fontsource_metadata, variable: false).variable?).to eq(true)
    end

    it "is false for a variable family without a weight axis" do
      family = build_family(fontsource_metadata, variable: false, axes: { "wdth" => {} })

      expect(family.variable?).to eq(false)
    end

    it "is false for a static family" do
      family = build_family(fontsource_metadata(variable: false), variable: false, axes: {})

      expect(family.variable?).to eq(false)
    end
  end

  describe ".fetch" do
    let(:base_url) { FontsourceStubs::API_URL }

    it "builds a variable family when the variable file exists" do
      stub_family(fontsource_metadata)

      family = described_class.fetch("inter")

      expect(face_summaries(family)).to eq(
        [
          ["100 900", "normal", "latin-wght-normal.woff2"],
          ["100 900", "normal", "latin-ext-wght-normal.woff2"],
        ],
      )
    end

    it "exposes the name and version of the family" do
      stub_family(fontsource_metadata(family: "Inter", version: "5.3.0"))

      family = described_class.fetch("inter")

      expect([family.font_id, family.name, family.version]).to eq(%w[inter Inter 5.3.0])
    end

    it "falls back to static files when the variable file is missing" do
      stub_family(fontsource_metadata(weights: [400]), variable_files: false)

      expect(face_summaries(described_class.fetch("inter"))).to eq(
        [%w[400 normal latin-400-normal.woff2], %w[400 normal latin-ext-400-normal.woff2]],
      )
    end

    it "builds a static family when Fontsource has no variable axes for it" do
      stub_family(fontsource_metadata(variable: false, weights: [400]), axes: nil)

      expect(face_summaries(described_class.fetch("inter")).map(&:first)).to all(eq("400"))
    end

    it "returns nil when the metadata can't be fetched" do
      stub_request(:get, "#{base_url}/v1/fonts/inter").to_return(status: 500)
      stub_json("#{base_url}/v1/variable/inter", { "axes" => fontsource_axes })

      expect(described_class.fetch("inter")).to be_nil
    end

    it "returns nil when the axes can't be fetched" do
      stub_json("#{base_url}/v1/fonts/inter", fontsource_metadata)
      stub_request(:get, "#{base_url}/v1/variable/inter").to_timeout

      expect(described_class.fetch("inter")).to be_nil
    end
  end
end
