# frozen_string_literal: true

require_relative "../../../support/fontsource_stubs"

RSpec.describe BbCode::Fontsource::Client do
  include FontsourceStubs

  describe ".font_list" do
    it "returns the parsed font list" do
      stub_font_list({ "inter" => "google" })

      expect(described_class.font_list).to eq({ "inter" => "google" })
    end

    it "returns nil when Fontsource responds with an error" do
      stub_request(:get, "#{FontsourceStubs::API_URL}/fontlist").to_return(status: 500)

      expect(described_class.font_list).to be_nil
    end

    it "returns nil when the request times out" do
      stub_request(:get, "#{FontsourceStubs::API_URL}/fontlist").to_timeout

      expect(described_class.font_list).to be_nil
    end

    it "returns nil when the response is not JSON" do
      stub_request(:get, "#{FontsourceStubs::API_URL}/fontlist").to_return(
        status: 200,
        body: "<html>",
      )

      expect(described_class.font_list).to be_nil
    end
  end

  describe ".metadata" do
    it "returns the metadata of a family" do
      metadata = fontsource_metadata
      stub_json("#{FontsourceStubs::API_URL}/v1/fonts/inter", metadata)

      expect(described_class.metadata("inter")).to eq(metadata)
    end

    it "returns nil for an id that is not well formed, without any request" do
      expect(described_class.metadata("../etc")).to be_nil
    end

    it "returns nil when the family is unknown" do
      stub_request(:get, "#{FontsourceStubs::API_URL}/v1/fonts/nope").to_return(status: 404)

      expect(described_class.metadata("nope")).to be_nil
    end
  end

  describe ".axes" do
    it "returns the axes of a variable family" do
      stub_json("#{FontsourceStubs::API_URL}/v1/variable/inter", { "axes" => fontsource_axes })

      expect(described_class.axes("inter")).to eq(fontsource_axes)
    end

    it "returns an empty hash for a static family" do
      stub_request(:get, "#{FontsourceStubs::API_URL}/v1/variable/static").to_return(status: 404)

      expect(described_class.axes("static")).to eq({})
    end

    it "returns nil when Fontsource responds with an error" do
      stub_request(:get, "#{FontsourceStubs::API_URL}/v1/variable/inter").to_return(status: 500)

      expect(described_class.axes("inter")).to be_nil
    end

    it "returns nil for an id that is not well formed" do
      expect(described_class.axes("Inter!")).to be_nil
    end
  end

  describe ".file_url" do
    it "points a variable file at the variable package" do
      expect(described_class.file_url("open-sans", "5.3.0", "latin-wght-normal.woff2")).to eq(
        "https://cdn.jsdelivr.net/fontsource/fonts/open-sans:vf@5.3.0/latin-wght-normal.woff2",
      )
    end

    it "points a static file at the family package" do
      expect(described_class.file_url("open-sans", "5.3.0", "latin-400-italic.woff2")).to eq(
        "https://cdn.jsdelivr.net/fontsource/fonts/open-sans@5.3.0/latin-400-italic.woff2",
      )
    end

    it "returns nil for a malformed filename, id or version" do
      urls = [
        described_class.file_url("inter", "5.3.0", "../latin-400-normal.woff2"),
        described_class.file_url("inter", "5.3.0", "latin-400-normal.woff"),
        described_class.file_url("In ter", "5.3.0", "latin-400-normal.woff2"),
        described_class.file_url("inter", "5.3.0/../x", "latin-400-normal.woff2"),
      ]

      expect(urls).to eq([nil, nil, nil, nil])
    end
  end

  describe ".file_exists?" do
    let(:url) { "#{FontsourceStubs::FILES_URL}/inter:vf@5.3.0/latin-wght-normal.woff2" }

    it "is true when the file can be downloaded" do
      stub_font_file(url)

      expect(described_class.file_exists?(url)).to eq(true)
    end

    it "is false when the file is missing" do
      stub_font_file(url, status: 404)

      expect(described_class.file_exists?(url)).to eq(false)
    end
  end

  describe ".download" do
    let(:url) { "#{FontsourceStubs::FILES_URL}/inter@5.3.0/latin-400-normal.woff2" }

    it "returns a file with the downloaded contents" do
      stub_font_file(url, body: "font-bytes")

      expect(described_class.download(url).read).to eq("font-bytes")
    end

    it "returns nil when the download fails" do
      stub_font_file(url, status: 500)

      expect(described_class.download(url)).to be_nil
    end

    it "returns nil when the request times out" do
      stub_request(:get, url).to_timeout

      expect(described_class.download(url)).to be_nil
    end
  end
end
