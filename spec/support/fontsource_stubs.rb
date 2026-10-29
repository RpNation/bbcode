# frozen_string_literal: true

# Builds tiny Fontsource payloads and stubs the Fontsource hosts, so no spec reaches the network.
module FontsourceStubs
  API_URL = "https://api.fontsource.org"
  FILES_URL = "https://cdn.jsdelivr.net/fontsource/fonts"
  LATIN_RANGE = "U+0000-00FF,U+0131"
  LATIN_EXT_RANGE = "U+0100-02BA"

  def fontsource_metadata(
    id: "inter",
    family: "Inter",
    version: "5.3.0",
    variable: true,
    weights: [400, 700],
    styles: %w[normal],
    ranges: { "latin" => LATIN_RANGE, "latin-ext" => LATIN_EXT_RANGE },
    file_keys: ranges.keys
  )
    variants =
      weights.to_h do |weight|
        faces =
          styles.to_h do |style|
            [
              style,
              file_keys.to_h { |key| [key, { "url" => { "woff2" => "https://example.test" } }] },
            ]
          end
        [weight.to_s, faces]
      end

    {
      "id" => id,
      "family" => family,
      "npmVersion" => version,
      "variable" => variable,
      "defSubset" => "latin",
      "styles" => styles,
      "weights" => weights,
      "unicodeRange" => ranges,
      "variants" => variants,
    }
  end

  def fontsource_axes(min: 100, max: 900)
    { "wght" => { "default" => "400", "min" => min.to_s, "max" => max.to_s, "step" => "1" } }
  end

  def stub_json(url, body, status: 200)
    stub_request(:get, url).to_return(
      status:,
      body: body.to_json,
      headers: {
        "Content-Type" => "application/json",
      },
    )
  end

  def stub_font_list(list = { "inter" => "google", "some-other" => "other" })
    stub_json("#{API_URL}/fontlist", list)
  end

  # A variable family, or a static one with axes: nil.
  def stub_family(metadata, axes: fontsource_axes, variable_files: true)
    id = metadata["id"]
    stub_json("#{API_URL}/v1/fonts/#{id}", metadata)

    if axes
      stub_json("#{API_URL}/v1/variable/#{id}", { "family" => metadata["family"], "axes" => axes })
    else
      stub_request(:get, "#{API_URL}/v1/variable/#{id}").to_return(status: 404, body: "")
    end

    metadata["styles"].each do |style|
      url = "#{FILES_URL}/#{id}:vf@#{metadata["npmVersion"]}/latin-wght-#{style}.woff2"
      stub_request(:get, url).to_return(
        status: variable_files ? 200 : 404,
        body: variable_files ? "woff2" : "",
      )
    end
  end

  def stub_font_file(url, body: "wOF2-font-bytes", status: 200)
    stub_request(:get, url).to_return(status:, body:, headers: { "Content-Type" => "font/woff2" })
  end

  def reset_font_list_cache
    Rails.cache.delete(BbCode::Fontsource::FontList::CACHE_KEY)
    Rails.cache.delete(BbCode::Fontsource::FontList::UNAVAILABLE_KEY)
  end
end
