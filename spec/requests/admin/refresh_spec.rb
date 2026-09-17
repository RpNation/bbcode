# frozen_string_literal: true

RSpec.describe "BBCode parser refresh" do
  fab!(:admin)
  fab!(:user)

  before do
    SiteSetting.bbcode_enabled = true
    allow(PrettyText).to receive(:reset_context)
  end

  it "requires an authenticated administrator" do
    post "/BbCode/admin/refresh.json"
    expect(response.status).to eq(403)
    expect(PrettyText).not_to have_received(:reset_context)

    sign_in(user)
    post "/BbCode/admin/refresh.json"
    expect(response.status).to eq(403)
    expect(PrettyText).not_to have_received(:reset_context)
  end

  it "resets and warms the parser through POST" do
    sign_in(admin)
    allow(PrettyText).to receive(:cook).with("warm up **pretty text**").and_return("warm")

    post "/BbCode/admin/refresh.json"

    expect(response.status).to eq(200)
    expect(PrettyText).to have_received(:reset_context).once
    expect(PrettyText).to have_received(:cook).with("warm up **pretty text**").once
  end

  it "does not mutate the parser through GET" do
    sign_in(admin)
    get "/BbCode/admin/refresh.json"

    expect(response.status).to eq(404)
    expect(PrettyText).not_to have_received(:reset_context)
  end

  it "does not refresh a disabled plugin" do
    sign_in(admin)
    SiteSetting.bbcode_enabled = false
    post "/BbCode/admin/refresh.json"

    expect(response.status).to eq(404)
    expect(PrettyText).not_to have_received(:reset_context)
  end

  it "reports a failed warmup to the administrator" do
    sign_in(admin)
    allow(PrettyText).to receive(:cook).with("warm up **pretty text**").and_raise(StandardError)

    post "/BbCode/admin/refresh.json"

    expect(response.status).to eq(500)
    expect(PrettyText).to have_received(:reset_context).once
  end
end
