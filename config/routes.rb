# frozen_string_literal: true

BbCode::Engine.routes.draw do
  namespace :admin, defaults: { format: :json, constraints: AdminConstraint.new } do
    post "refresh" => "refresh#index"
  end
end

Discourse::Application.routes.draw { mount ::BbCode::Engine, at: "BbCode" }
