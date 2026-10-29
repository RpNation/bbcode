# frozen_string_literal: true

RSpec.describe BbCode::Font::Action::EnqueueOnce do
  def enqueued_font_ids(job)
    job.jobs.map { |enqueued| enqueued["args"].first["font_id"] }
  end

  [Jobs::BbCode::ImportFont, Jobs::BbCode::RevalidateFont].each do |job|
    describe ".call with #{job}" do
      it "queues the job for the font" do
        described_class.call(job:, font_id: "inter")

        expect(enqueued_font_ids(job)).to eq(["inter"])
      end

      it "doesn't queue it again for the same font while its retry delay lasts" do
        2.times { described_class.call(job:, font_id: "inter") }

        expect(enqueued_font_ids(job)).to eq(["inter"])
      end

      it "queues it for another font" do
        described_class.call(job:, font_id: "inter")
        described_class.call(job:, font_id: "lora")

        expect(enqueued_font_ids(job)).to contain_exactly("inter", "lora")
      end
    end
  end

  it "keeps what one job has queued from stopping another job for the same font" do
    described_class.call(job: Jobs::BbCode::ImportFont, font_id: "inter")
    described_class.call(job: Jobs::BbCode::RevalidateFont, font_id: "inter")

    expect(
      [Jobs::BbCode::ImportFont, Jobs::BbCode::RevalidateFont].map { |job| enqueued_font_ids(job) },
    ).to eq([["inter"], ["inter"]])
  end
end
