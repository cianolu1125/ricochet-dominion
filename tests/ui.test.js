import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Window } from "happy-dom";
import { build } from "esbuild";
const bundled = await build({
  entryPoints: ["src/main.js"],
  bundle: true,
  write: false,
  format: "iife",
  loader: { ".css": "empty" },
});
const html = (await readFile("index.html", "utf8")).replace(
  /<script[\s\S]*?<\/script>/g,
  "",
);
async function setup(width) {
  let currentWidth = width;
  const w = new Window({
    url: "https://example.test",
    settings: {
      disableCSSFileLoading: true,
      disableJavaScriptFileLoading: true,
    },
  });
  w.document.write(html);
  w.matchMedia = (q) => ({
    matches: q.includes("min-width") ? currentWidth >= 900 : false,
    addEventListener() {},
    removeEventListener() {},
  });
  let queue = [],
    clock = 0,
    tool;
  w.requestAnimationFrame = (fn) => {
    queue.push(fn);
    return 1;
  };
  w.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  w.structuredClone = structuredClone;
  w.document.modelContext = {
    registerTool(t) {
      tool = t;
    },
  };
  const canvas = w.document.getElementById("board"),
    shell = canvas.parentElement;
  canvas.getContext = () =>
    new Proxy({}, { get: () => () => {}, set: () => true });
  shell.getBoundingClientRect = () => ({
    width: currentWidth >= 900 ? 900 : currentWidth - 24,
    height: currentWidth >= 900 ? 500 : 520,
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
  w.eval(bundled.outputFiles[0].text);
  const click = (selector) => {
    const e = w.document.querySelector(selector);
    assert.ok(e, selector);
    assert.equal(e.disabled, false, selector);
    e.click();
  };
  const read = (input = {}) => tool.execute(input);
  const tick = (ms) => {
    clock += ms;
    const q = queue;
    queue = [];
    for (const fn of q) fn(clock);
  };
  return {
    w,
    click,
    read,
    tick,
    canvas,
    resize(n) {
      currentWidth = n;
      w.dispatchEvent(new w.Event("resize"));
    },
    close: () => w.happyDOM.abort(),
  };
}
for (const width of [390, 1440])
  test(`DOM smoke ${width}: start, build, handoff, aim and menu`, async () => {
    const a = await setup(width);
    try {
      assert.equal(a.w.document.getElementById("modal").dataset.kind, "home");
      a.click('[data-modal="start"]');
      assert.equal(a.read().phase, "ROLE_ACTION");
      a.click('[data-action="stay"]');
      a.click('[data-action="tower"]');
      assert.equal(a.read().towers.length, 1);
      assert.equal(a.read().phase, "TURN_END");
      a.click('[data-action="end"]');
      if (width < 900) {
        assert.equal(a.read().phase, "HANDOFF");
        a.click('[data-modal="ready"]');
        a.tick(1000);
      }
      assert.equal(a.read().current, "蓝方");
      assert.equal(a.read().phase, "ROLE_ACTION");
      a.click('[data-action="stay"]');
      a.click('[data-action="missiles"]');
      a.click("#precise-fire");
      assert.equal(a.read().phase, "MISSILE_FLYING");
      for (let i = 0; i < 500 && a.read().phase === "MISSILE_FLYING"; i++)
        a.tick(16);
      assert.equal(a.read().phase, "MISSILE_AIM");
      a.click('[data-action="finish"]');
      a.click('[data-action="end"]');
      if (width < 900) {
        a.click('[data-modal="ready"]');
        a.tick(1000);
      }
      assert.equal(a.read().current, "红方");
      assert.equal(a.read().towers[0].stage, 1);
      a.click("#menu");
      assert.equal(a.w.document.getElementById("modal").dataset.kind, "menu");
      a.click('[data-modal="close"]');
      assert.equal(a.w.document.getElementById("modal").open, false);
    } finally {
      await a.close();
    }
  });
test("read-only WebMCP rejects invalid input without modifying match", async () => {
  const a = await setup(390);
  try {
    const s = a.read();
    assert.throws(() => a.read({ extra: 1 }), /empty object/);
    assert.throws(() => a.read(null), /empty object/);
    assert.deepEqual(a.read(), s);
  } finally {
    await a.close();
  }
});
test("mobile touch movement and layout resize preserve role and turn state", async () => {
  const a = await setup(390);
  try {
    a.click('[data-modal="start"]');
    const tile = a.canvas.clientWidth / 18;
    for (const [type, y] of [
      ["pointerdown", 30.5],
      ["pointermove", 20.5],
      ["pointerup", 20.5],
    ])
      a.canvas.dispatchEvent(
        new a.w.PointerEvent(type, {
          pointerId: 1,
          button: 0,
          clientX: 8.5 * tile,
          clientY: y * tile,
          bubbles: true,
        }),
      );
    assert.equal(a.read().players[1].pos.y, 20);
    const before = a.read();
    a.resize(1440);
    assert.deepEqual(a.read(), before);
    a.resize(390);
    assert.deepEqual(a.read(), before);
    assert.equal(a.read().phase, "TACTICAL_CHOICE");
  } finally {
    await a.close();
  }
});
test("Escape from home rules returns to setup with chosen round count", async () => {
  const a = await setup(390);
  try {
    a.click('[data-modal="round-10"]');
    a.click('[data-modal="rules"]');
    a.w.document
      .getElementById("modal")
      .dispatchEvent(new a.w.Event("cancel", { cancelable: true }));
    assert.equal(a.w.document.getElementById("modal").dataset.kind, "home");
    a.click('[data-modal="start"]');
    assert.equal(a.read().round, 1);
    assert.equal(
      a.w.document.getElementById("round").textContent,
      "ROUND 01 / 10",
    );
  } finally {
    await a.close();
  }
});
test("home after result remains home across viewport resize", async () => {
  const a = await setup(1440);
  try {
    a.click('[data-modal="round-10"]');
    a.click('[data-modal="start"]');
    for (let n = 0; n < 22; n++) {
      a.click('[data-action="stay"]');
      a.click('[data-action="missiles"]');
      a.click('[data-action="finish"]');
      a.click('[data-action="end"]');
    }
    assert.equal(a.w.document.getElementById("modal").dataset.kind, "result");
    a.click('[data-modal="home"]');
    a.resize(390);
    assert.equal(a.w.document.getElementById("modal").dataset.kind, "home");
  } finally {
    await a.close();
  }
});
