# frozen_string_literal: true

class CreateBbcodeFonts < ActiveRecord::Migration[8.1]
  def change
    create_table :bbcode_fonts do |t|
      t.string :font_id, null: false
      t.string :family, null: false
      t.string :version, null: false
      t.text :css, null: false
      t.datetime :checked_at, null: false
      t.datetime :last_used_at, null: false
      t.timestamps
    end

    add_index :bbcode_fonts, :font_id, unique: true
    add_index :bbcode_fonts, :last_used_at
  end
end
