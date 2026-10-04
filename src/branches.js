const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
// One tactical column shifts inward as a unit; the character remains visible.
export function branchLayout(anchor, bounds, level = "root", widths = []) {
  const keys =
    level === "action"
      ? ["missile", "tower", "dismantle", "root"]
      : level === "select"
        ? ["action"]
        : ["move", "action"];
  const width =
    level === "action"
      ? Math.min(144, Math.max(132, ...widths.slice(1)))
      : level === "select"
        ? 44
        : Math.max(80, ...widths);
  const height = 44,
    gap = 8,
    total = keys.length * height + (keys.length - 1) * gap;
  let best;
  for (const side of [-1, 1])
    for (const dy of [0, -total / 2 - 40, total / 2 + 40]) {
      const rawX = anchor.x + side * (width / 2 + 32),
        rawTop = anchor.y - total / 2 + dy;
      const x = clamp(rawX, bounds.left + width / 2, bounds.right - width / 2),
        top = clamp(rawTop, bounds.top, bounds.bottom - total);
      const nodes = keys.map((key, i) => ({
        key,
        x,
        y: top + height / 2 + i * (height + gap),
        width: key === "root" || level === "select" ? 44 : width,
        height,
      }));
      let score =
        Math.abs(x - rawX) + Math.abs(top - rawTop) + Math.abs(dy) * 0.3;
      for (const n of nodes)
        if (
          Math.abs(n.x - anchor.x) < n.width / 2 + 14 &&
          Math.abs(n.y - anchor.y) < height / 2 + 14
        )
          score += 1000;
      if (!best || score < best.score)
        best = {
          score,
          nodes,
          links:
            level === "action" || level === "select"
              ? [{ from: anchor, to: nodes[0] }]
              : nodes.map((to) => ({ from: anchor, to })),
        };
    }
  return best;
}
