# frozen_string_literal: true

RSpec.describe PrettyText, ".cook" do
  def cooked_span(raw)
    Nokogiri::HTML5.fragment(PrettyText.cook(raw)).at_css("span")
  end

  def face_of(span)
    span["style"].match(/font-weight: (?<weight>\d+); font-style: (?<style>\w+)/).named_captures
  end

  it "renders a google font with a regular upright face and a generic fallback" do
    span = cooked_span("[font=Roboto]text[/font]")

    expect(span["style"]).to eq(
      "font-family: 'Roboto', sans-serif; font-weight: 400; font-style: normal;",
    )
    expect(span["data-font"]).to eq("Roboto")
  end

  it "accepts the family from the default, family and name attributes" do
    spans =
      [
        '[font="Open Sans"]t[/font]',
        '[font family="Open Sans"]t[/font]',
        '[font name="Open  Sans"]t[/font]',
      ].map { |raw| cooked_span(raw) }

    expect(spans.map { |span| span["data-font"] }).to all(eq("Open Sans"))
  end

  it "reads weight and italic from the style attribute" do
    faces = {
      "light" => {
        "weight" => "300",
        "style" => "normal",
      },
      "700" => {
        "weight" => "700",
        "style" => "normal",
      },
      "italic" => {
        "weight" => "400",
        "style" => "italic",
      },
      "bold italic" => {
        "weight" => "700",
        "style" => "italic",
      },
      "300 italic" => {
        "weight" => "300",
        "style" => "italic",
      },
      "1000" => {
        "weight" => "400",
        "style" => "normal",
      },
    }

    actual =
      faces.keys.to_h do |style|
        [style, face_of(cooked_span(%([font family="Lora" style="#{style}"]t[/font])))]
      end

    expect(actual).to eq(faces)
  end

  it "applies registered axes with or without a style attribute" do
    with_style = cooked_span('[font family="Open Sans" style="regular" wdth=75]t[/font]')
    without_style = cooked_span('[font family="Open Sans" wdth=75]t[/font]')

    expect([with_style, without_style].map { |span| span["style"] }).to all(
      include("font-weight: 400; font-style: normal; font-variation-settings: 'wdth' 75;"),
    )
  end

  it "honors ital and wght given as axes" do
    span = cooked_span('[font family="Lora" ital=1 wght=700]t[/font]')

    expect(face_of(span)).to eq({ "weight" => "700", "style" => "italic" })
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
