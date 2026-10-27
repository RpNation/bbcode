# frozen_string_literal: true

# Discourse adds a plugin's lib/tasks to rake, and so does the plugin's Rails engine, so rake can load
# this file twice, which would run every task twice.
return if Rake::Task.task_defined?("bbcode:fonts:list")

desc "Lists the Google fonts the font BBCode has stored, and the space their files use"
task "bbcode:fonts:list" => :environment do
  bbcode_fonts_on_each_site { bbcode_fonts_list }
end

desc "Checks stored fonts against Fontsource now, due or not. Pass a font id (e.g. open-sans), or none for all of them"
task "bbcode:fonts:refresh", [:font_id] => :environment do |_task, args|
  bbcode_fonts_on_each_site do
    bbcode_fonts_selected(args[:font_id]).each do |font_id, version_before|
      result = BbCode::Font::Revalidate.call(params: { font_id: }, options: { force: true })
      puts bbcode_fonts_refresh_outcome(font_id, version_before, result)
    end
  end
end

desc "Deletes stored fonts and their files now, idle or not. Pass a font id (e.g. open-sans), or none for all of them"
task "bbcode:fonts:purge", [:font_id] => :environment do |_task, args|
  bbcode_fonts_on_each_site do
    bbcode_fonts_selected(args[:font_id]).each do |font_id, _version|
      result = BbCode::Font::Evict.call(params: { font_id: }, options: { force: true })
      puts result.success? ? "#{font_id}: deleted" : bbcode_fonts_failure(font_id, result)
    end
  end
end

def bbcode_fonts_on_each_site(&block)
  if ENV["RAILS_DB"]
    bbcode_fonts_on_current_site(&block)
  else
    RailsMultisite::ConnectionManagement.each_connection { bbcode_fonts_on_current_site(&block) }
  end
end

def bbcode_fonts_on_current_site
  puts "BBCode fonts on #{RailsMultisite::ConnectionManagement.current_db}"
  yield
end

# [font id, version] of the stored fonts to act on: the given one, or all of them.
def bbcode_fonts_selected(font_id)
  fonts = BbCode::Font.order(:font_id)
  fonts = fonts.where(font_id:) if font_id.present?

  fonts
    .pluck(:font_id, :version)
    .tap do |selected|
      if selected.empty?
        puts font_id.present? ? "No stored font named '#{font_id}'." : "No fonts are stored."
      end
    end
end

def bbcode_fonts_refresh_outcome(font_id, version_before, result)
  return bbcode_fonts_failure(font_id, result) if result.failure?

  version = BbCode::Font.where(font_id:).pick(:version)
  if version == version_before
    "#{font_id}: up to date (#{version})"
  else
    "#{font_id}: #{version_before} -> #{version}"
  end
end

def bbcode_fonts_failure(font_id, result)
  "#{font_id}: FAILED\n#{result.inspect_steps}"
end

def bbcode_fonts_list
  fonts =
    BbCode::Font.select(:id, :font_id, :version, :checked_at, :last_used_at).order(:font_id).to_a
  return puts("No fonts are stored.") if fonts.empty?

  files = bbcode_fonts_file_totals
  rows =
    fonts.map do |font|
      count, bytes = files.fetch(font.id, [0, 0])
      state = [("due" if font.revalidation_due?), ("idle" if font.idle?)].compact.join(",")
      [
        font.font_id,
        font.version,
        count.to_s,
        bbcode_fonts_size(bytes),
        bbcode_fonts_age(font.last_used_at),
        bbcode_fonts_age(font.checked_at),
        state,
      ]
    end

  table = [%w[FONT VERSION FILES SIZE USED CHECKED STATE]] + rows
  widths = table.transpose.map { |column| column.map(&:length).max }
  table.each do |row|
    puts row.zip(widths).map { |cell, width| cell.ljust(width) }.join("  ").rstrip
  end

  file_count = files.values.sum(&:first)
  puts "",
       "#{fonts.size} #{"font".pluralize(fonts.size)}, " \
         "#{file_count} #{"file".pluralize(file_count)}, " \
         "#{bbcode_fonts_size(files.values.sum(&:last))}"
end

# { font record id => [number of files, bytes] } for the files stored for each font, retired ones included.
def bbcode_fonts_file_totals
  UploadReference
    .where(target_type: BbCode::Font.upload_target_types)
    .joins(:upload)
    .group(:target_id)
    .pluck(:target_id, Arel.sql("COUNT(*)"), Arel.sql("SUM(uploads.filesize)"))
    .to_h { |id, count, bytes| [id, [count, bytes.to_i]] }
end

def bbcode_fonts_size(bytes)
  ActiveSupport::NumberHelper.number_to_human_size(bytes)
end

def bbcode_fonts_age(time)
  days = ((Time.zone.now - time) / 1.day).floor
  days.zero? ? "today" : "#{days}d ago"
end
