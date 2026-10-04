import test from "node:test";
import assert from "node:assert/strict";
import { branchLayout } from "../src/branches.js";
// A broken edge direction or oversized arc would push controls off screen or overlap.
for (const width of [320, 390, 768, 1440])
  for (const level of ["root", "action"]) {
    test(`${level} branches stay separate at all battlefield edges (${width})`, () => {
      const bounds = { left: 4, top: 4, right: width - 4, bottom: 500 };
      for (const anchor of [
        { x: 10, y: 10 },
        { x: width - 10, y: 10 },
        { x: 10, y: 490 },
        { x: width - 10, y: 490 },
        { x: width / 2, y: 490 },
        { x: width / 2, y: 250 },
      ]) {
        const result = branchLayout(anchor, bounds, level);
        assert.equal(result.nodes.length, level === "root" ? 2 : 4);
        for (const n of result.nodes) {
          assert.ok(n.x - n.width / 2 >= bounds.left - 0.01);
          assert.ok(n.x + n.width / 2 <= bounds.right + 0.01);
          assert.ok(n.y - n.height / 2 >= bounds.top - 0.01);
          assert.ok(n.y + n.height / 2 <= bounds.bottom + 0.01);
        }
        for (let i = 0; i < result.nodes.length; i++)
          for (let j = i + 1; j < result.nodes.length; j++) {
            const a = result.nodes[i],
              b = result.nodes[j];
            assert.ok(
              Math.abs(a.x - b.x) >= (a.width + b.width) / 2 + 3 ||
                Math.abs(a.y - b.y) >= (a.height + b.height) / 2 + 3,
              "touch targets overlap",
            );
          }
        assert.equal(result.links.length, level === "root" ? 2 : 1);
      }
    });
  }
test("action uses one equal-width tactical column and one connector", () => {
  const a = branchLayout(
    { x: 160, y: 250 },
    { left: 12, top: 12, right: 308, bottom: 500 },
    "action",
  );
  const nodes = a.nodes.filter((n) => n.key !== "root");
  assert.equal(new Set(nodes.map((n) => n.x)).size, 1);
  assert.equal(new Set(nodes.map((n) => n.width)).size, 1);
  assert.equal(a.links.length, 1);
});
