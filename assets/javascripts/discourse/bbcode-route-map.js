export default {
  resource: "admin.adminPlugins.show",
  path: "/plugins",

  map() {
    this.route("bbcode-reset", { path: "reset" });
  },
};
