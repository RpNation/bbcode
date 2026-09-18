import { module, test } from "qunit";
import sinon from "sinon";
import { createBBScriptDecorator } from "discourse/plugins/bbcode/discourse/initializers/bbscript";

function script(on = "click") {
  return `<template data-bbcode-plus="script" data-bbscript-id="example" data-bbscript-class="button" data-bbscript-ver="1" data-bbscript-on="${on}">script</template><button class="button__example">Run</button>`;
}

module("BBCode | Unit | BBScript decoration", function (hooks) {
  hooks.beforeEach(function () {
    this.post = document.createElement("div");
    this.post.className = "d-editor-preview";
    this.post.innerHTML = script();
    document.getElementById("qunit-fixture").append(this.post);
    this.originalParser = window.bbscriptParser;
    this.exec = sinon.spy();
    window.bbscriptParser = {
      bbscriptData: {},
      bbscriptProcessorV1: { parse: (source) => source, execAll: this.exec },
    };
    this.decorate = createBBScriptDecorator(() => Promise.resolve());
    this.sandbox = sinon.createSandbox();
  });

  hooks.afterEach(function () {
    this.cleanup?.();
    window.bbscriptParser = this.originalParser;
    this.sandbox.restore();
  });

  test("preview redecoration replaces delegated event listeners", async function (assert) {
    this.decorate(this.post);
    await Promise.resolve();
    await Promise.resolve();
    this.cleanup = this.decorate(this.post);
    await Promise.resolve();
    this.post.querySelector("button").click();
    assert.true(this.exec.calledOnce);
    this.cleanup();
    this.post.querySelector("button").click();
    assert.true(this.exec.calledOnce, "cleanup aborts the delegated click listener");
  });

  test("cleanup prevents a late parser load from decorating removed content", async function (assert) {
    let loaded;
    const decorate = createBBScriptDecorator(() => new Promise((resolve) => (loaded = resolve)));
    this.cleanup = decorate(this.post);
    this.cleanup();
    loaded();
    await Promise.resolve();
    await Promise.resolve();
    this.post.querySelector("button").click();
    assert.false(this.exec.called);
  });

  test("init runs lazily once and ignores an observer callback queued before cleanup", async function (assert) {
    this.post.className = "cooked";
    this.post.innerHTML = script("init");
    const observers = [];
    this.sandbox.stub(window, "IntersectionObserver").callsFake(function (callback) {
      const observer = { callback, observe: sinon.spy(), disconnect: sinon.spy() };
      observers.push(observer);
      return observer;
    });
    this.cleanup = this.decorate(this.post);
    await Promise.resolve();
    await Promise.resolve();
    assert.false(this.exec.called);
    assert.true(observers[0].observe.calledWith(this.post));
    observers[0].callback([{ isIntersecting: true }]);
    assert.true(this.exec.calledOnce);
    assert.true(observers[0].disconnect.calledOnce);
    observers[0].callback([{ isIntersecting: true }]);
    assert.true(this.exec.calledOnce, "already executed init scripts do not run twice");
    this.cleanup();
    observers[0].callback([{ isIntersecting: true }]);
    assert.true(this.exec.calledOnce, "an inactive observer cannot run scripts");
  });

  test("init targets stay inside their own post", async function (assert) {
    this.post.innerHTML = script("init");
    const outside = document.createElement("button");
    outside.className = "button__example";
    document.getElementById("qunit-fixture").append(outside);
    this.cleanup = this.decorate(this.post);
    await Promise.resolve();
    await Promise.resolve();
    assert.true(this.exec.calledOnce);
    const targets = this.exec.firstCall.args[3].target;
    assert.strictEqual(targets.length, 1);
    assert.strictEqual(targets[0], this.post.querySelector("button"));
  });
});
