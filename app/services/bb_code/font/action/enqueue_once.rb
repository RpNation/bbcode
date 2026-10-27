# frozen_string_literal: true

class BbCode::Font::Action::EnqueueOnce < Service::ActionBase
  option :job
  option :font_id

  # Queues the job unless it was already queued for this font within the job's RETRY_DELAY, which
  # also keeps a font whose job failed from being tried again straight away.
  def call
    return if !Discourse.redis.set(lock_key, 1, nx: true, ex: job::RETRY_DELAY.to_i)

    Jobs.enqueue(job, font_id:)
  end

  private

  def lock_key
    "bbcode-font-job:#{job.name}:#{font_id}"
  end
end
