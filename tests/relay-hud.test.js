import test from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { RelayHUD } from "../src/relay-hud.js";
import { createGame } from "../src/engine.js";
test("repeated relay HUD activation continues from current brightness", () => {
  const w = new Window();
  const el = w.document.createElement("div");
  el.innerHTML =
    '<div id="relay-track"></div><span id="relay-count"></span><span id="relay-skill"></span>';
  const hud = new RelayHUD(el),
    s = createGame();
  hud.sync(s, 0, "en", { 1: "#fff", 2: "#000" });
  hud.activate(0);
  hud.sync(s, 100, "en", { 1: "#fff", 2: "#000" });
  const before = Number(el.style.getPropertyValue("--relay-focus"));
  hud.activate(100);
  hud.sync(s, 100, "en", { 1: "#fff", 2: "#000" });
  assert.ok(Number(el.style.getPropertyValue("--relay-focus")) >= before);
});
