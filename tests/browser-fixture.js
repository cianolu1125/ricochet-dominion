import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Window } from "happy-dom";
import { build } from "esbuild";
import * as E from "../src/engine.js";
import { battlefieldViewport } from "../src/view.js";
export async function setup(
  width = 390,
  height = 844,
  touch = true,
  reduceMotion = false,
) {
  const b = await build({
    entryPoints: ["src/main.js"],
    bundle: true,
    write: false,
    format: "iife",
    define: {"import.meta.url": JSON.stringify("https://example.test/src/main.js")},
    loader: { ".css": "empty" },
    plugins: [
      {
        name: "fixture",
        setup(builder) {
          builder.onLoad({ filter: /src\/main\.js$/ }, async (args) => ({
            contents:
              (await readFile(args.path, "utf8")) +
              "\nwindow.useFixtureForTest=s=>{state=s;update();};window.freezeForTest=until=>{feedback.freezeUntil=until;};window.presentForTest=e=>submit(e.type,e);",
            loader: "js",
          }));
        },
      },
    ],
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
    matches: q.includes("pointer")
      ? touch
      : q.includes("reduced-motion")
        ? reduceMotion
        : false,
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
  w.performance.now = () => time;
  w.requestAnimationFrame = (f) => {
    frames.push(f);
    return 1;
  };
  w.document.modelContext = { registerTool: (t) => (tool = t) };
  const canvas = w.document.getElementById("board");
  canvas.getContext = () =>
    new Proxy({}, { get: (o,key) => key === "measureText" ? text => ({width: text.length * .35}) : key === "createLinearGradient" || key === "createRadialGradient" ? () => ({addColorStop(){}}) : () => {}, set: () => true });
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
