# frozen_string_literal: true

RSpec.describe "BBCode [font]" do
  def cooked_span(raw)
    Nokogiri::HTML5.fragment(PrettyText.cook(raw)).at_css("span")
  end

  def google_font_params(span)
    URI.parse(span["data-font"]).query
  end

  it "renders a google font with a regular upright face and a generic fallback" do
    span = cooked_span("[font=Roboto]text[/font]")

    expect(span["style"]).to eq(
      "font-family: 'Roboto', sans-serif; font-weight: 400; font-style: normal;",
    )
    expect(span["data-font"]).to eq(
      "https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,400",
    )
  end

  it "accepts the family from the default, family and name attributes" do
    families =
      [
        '[font="Open Sans"]t[/font]',
        '[font family="Open Sans"]t[/font]',
        '[font name="Open  Sans"]t[/font]',
      ].map { |raw| google_font_params(cooked_span(raw)) }

    expect(families).to all(eq("family=Open+Sans:ital,wght@0,400"))
  end

  it "reads weight and italic from the style attribute" do
    styles = {
      "light" => "wght@0,300",
      "700" => "wght@0,700",
      "italic" => "wght@1,400",
      "bold italic" => "wght@1,700",
      "300 italic" => "wght@1,300",
      "1000" => "wght@0,400",
    }

    actual =
      styles.keys.to_h do |style|
        span = cooked_span(%([font family="Lora" style="#{style}"]t[/font]))
        [style, google_font_params(span)[/wght@.*/]]
      end

    expect(actual).to eq(styles)
    expect(cooked_span('[font family="Lora" style="italic"]t[/font]')["style"]).to include(
      "font-style: italic",
    )
  end

  it "applies registered axes with or without a style attribute" do
    with_style = cooked_span('[font family="Open Sans" style="regular" wdth=75]t[/font]')
    without_style = cooked_span('[font family="Open Sans" wdth=75]t[/font]')

    [with_style, without_style].each do |span|
      expect(span["style"]).to include("font-variation-settings: 'wdth' 75;")
      expect(google_font_params(span)).to eq("family=Open+Sans:ital,wdth,wght@0,75,400")
    end
  end

  it "honors ital and wght given as axes" do
    span = cooked_span('[font family="Lora" ital=1 wght=700]t[/font]')

    expect(span["style"]).to include("font-weight: 700; font-style: italic;")
    expect(google_font_params(span)).to eq("family=Lora:ital,wght@1,700")
  end

  it "renders web safe fonts with a matching generic fallback and no google font" do
    georgia = cooked_span("[font=Georgia]t[/font]")
    courier = cooked_span('[font family="Courier New"]t[/font]')

    expect(georgia["style"]).to eq("font-family: 'Georgia', serif")
    expect(courier["style"]).to eq("font-family: 'Courier New', monospace")
    expect([georgia["data-font"], courier["data-font"]]).to all(be_nil)
  end

  it "renders only the content for family names that are not plain letters, digits and spaces" do
    unsafe_families = [
      "a'b;color:red",
      "Roboto&family=Evil",
      "Roboto:wght@900",
      "../../x",
      "Ünïcode",
      "A" * 80,
      "",
    ]

    unsafe_families.each do |family|
      cooked = PrettyText.cook(%([font family="#{family}"]plain text[/font]))

      expect(cooked).not_to include("<span")
      expect(cooked).to include("plain text")
    end
  end
end
