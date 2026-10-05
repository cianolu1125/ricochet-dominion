import { grid, inside, index, protectedOwner } from "./engine.js";
export const chargeFromRelays = (count) =>
  count >= 5 ? 3 : count >= 3 ? 2 : count >= 1 ? 1 : 0;
export const chargeRadius = (level) => (level === 1 || level === 3 ? 2 : 1);
export function paintTargets(state, position, level) {
  const center = grid(state, position),
    radius = chargeRadius(level),
    targets = new Set();
  for (let y = center.y - radius; y <= center.y + radius; y++)
    for (let x = center.x - radius; x <= center.x + radius; x++)
      if (inside(state, { x, y })) targets.add(index(state, { x, y }));
  if (level >= 2)
    for (const i of crossTrace(state, position).targets) targets.add(i);
  return targets;
}
// Four independent rays; a protected tile blocks its ray before painting.
// The square blast is separate and keeps its existing shield rules.
export function crossTrace(state, position) {
  const center = grid(state, position), targets = new Set(), shielded = [], ends = [];
  for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
    let x = center.x + dx, y = center.y + dy;
    while (inside(state, {x,y})) {
      const i = index(state, {x,y});
      if (protectedOwner(state, i)) { shielded.push(i); break; }
      targets.add(i); x += dx; y += dy;
    }
    ends.push({x: dx ? x + (dx < 0 ? 1 : 0) : center.x + 0.5,
      y: dy ? y + (dy < 0 ? 1 : 0) : center.y + 0.5});
  }
  return {targets, shielded, ends};
}
