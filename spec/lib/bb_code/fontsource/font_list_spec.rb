# frozen_string_literal: true

require_relative "../../../support/fontsource_stubs"

RSpec.describe BbCode::Fontsource::FontList do
  include FontsourceStubs

  before { reset_font_list_cache }

  describe ".ids" do
    it "returns only the Google families" do
      stub_font_list({ "inter" => "google", "open-sans" => "google", "some-other" => "other" })

      expect(described_class.ids).to eq(Set["inter", "open-sans"])
    end

    it "caches the list" do
      stub = stub_font_list
      2.times { described_class.ids }

      expect(stub).to have_been_requested.once
    end

    it "returns nil when Fontsource can't be reached" do
      stub_request(:get, "#{FontsourceStubs::API_URL}/fontlist").to_return(status: 500)

      expect(described_class.ids).to be_nil
    end

    it "doesn't ask Fontsource again while an outage is remembered" do
      failing = stub_request(:get, "#{FontsourceStubs::API_URL}/fontlist").to_return(status: 500)

      3.times { described_class.ids }

      expect(failing).to have_been_requested.once
    end

    it "asks Fontsource again once the remembered outage is gone" do
      stub_request(:get, "#{FontsourceStubs::API_URL}/fontlist").to_return(status: 500)
      described_class.ids
      stub_font_list
      Rails.cache.delete(described_class::UNAVAILABLE_KEY)

      expect(described_class.ids).to eq(Set["inter"])
    end
  end
end
