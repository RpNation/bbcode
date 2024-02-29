# frozen_string_literal: true

BbCode::Engine.routes.draw do
  namespace :admin, defaults: { format: :json, constraints: StaffConstraint.new } do
    get "refresh" => "refresh#index"
  end
end

Discourse::Application.routes.draw { mount ::BbCode::Engine, at: "BbCode" }
