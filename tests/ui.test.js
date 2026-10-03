import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Window } from "happy-dom";
import { build } from "esbuild";
async function setup(width = 390, height = 844, touch = true) {
  const b = await build({
    entryPoints: ["src/main.js"],
    bundle: true,
    write: false,
    format: "iife",
    loader: { ".css": "empty" },
  });
  const w = new Window({
    url: "https://example.test",
    settings: {
      disableCSSFileLoading: true,
      disableJavaScriptFileLoading: true,
    },
  });
  w.document.write(
    (await readFile("index.html", "utf8")).replace(
      /<script[\s\S]*?<\/script>/g,
      "",
    ),
  );
  w.matchMedia = (q) => ({
    matches: q.includes("pointer") ? touch : false,
    addEventListener() {},
  });
  Object.defineProperty(w, "innerWidth", { value: width, writable: true });
  Object.defineProperty(w, "innerHeight", { value: height, writable: true });
  w.ResizeObserver = class {
    observe() {}
  };
  w.structuredClone = structuredClone;
  let frames = [],
    time = 0,
    tool;
  w.requestAnimationFrame = (f) => {
    frames.push(f);
    return 1;
  };
  w.document.modelContext = { registerTool: (t) => (tool = t) };
  const canvas = w.document.getElementById("board");
  canvas.getContext = () =>
    new Proxy({}, { get: () => () => {}, set: () => true });
  canvas.parentElement.getBoundingClientRect = () => ({
    width: w.innerWidth,
    height: w.innerHeight,
  });
  Object.defineProperty(canvas, "clientWidth", {
    get: () => parseFloat(canvas.style.width) || 1,
  });
  Object.defineProperty(canvas, "clientHeight", {
    get: () => parseFloat(canvas.style.height) || 1,
  });
  canvas.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: canvas.clientWidth,
    height: canvas.clientHeight,
  });
  canvas.setPointerCapture = () => {};
  canvas.hasPointerCapture = () => false;
  w.eval(b.outputFiles[0].text);
  const click = (sel) => {
    const el = w.document.querySelector(sel);
    assert.ok(el, sel);
    assert.equal(el.disabled, false, sel);
    el.click();
  };
  return {
    w,
    canvas,
    click,
    read: () => tool.execute({}),
    tick(ms) {
      time += ms;
      const q = frames;
      frames = [];
      q.forEach((f) => f(time));
    },
    close: () => w.happyDOM.abort(),
  };
}
for (const [width, height, touch] of [
  [320, 568, true],
  [390, 844, true],
  [768, 1024, true],
  [1024, 768, true],
  [1440, 900, false],
])
  test(`UI ${width}x${height}: free-order menu cancel handoff resize`, async () => {
    const a = await setup(width, height, touch);
    try {
      a.click('[data-panel="start"]');
      assert.equal(a.read().players[1].hp, 10);
      a.click("#fab");
      assert.ok(a.w.document.querySelector('[data-action="move"]'));
      assert.ok(a.w.document.querySelector('[data-action="action"]'));
      a.click('[data-action="action"]');
      a.click('[data-action="missile"]');
      assert.equal(a.read().phase, "MISSILE_AIM");
      a.click("#fab");
      assert.equal(a.read().actionAvailable, true);
      a.click("#fab");
      a.click('[data-action="move"]');
      a.click('[data-action="skip-move"]');
      assert.equal(a.read().moveAvailable, false);
      a.click("#fab");
      a.click('[data-action="end"]');
      assert.equal(a.read().phase, "HANDOFF");
      a.click('[data-panel="ready"]');
      a.tick(400);
      assert.equal(a.read().current, 2);
      const before = a.read();
      a.w.innerWidth = height;
      a.w.innerHeight = width;
      a.w.dispatchEvent(new a.w.Event("resize"));
      assert.deepEqual(a.read().players, before.players);
      assert.equal(a.read().width, before.width);
      a.click("#help");
      a.click('[data-panel="close"]');
      assert.equal(a.read().phase, "IDLE");
    } finally {
      await a.close();
    }
  });
