import { grid, inside, index } from "./engine.js";
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
  if (level >= 2) {
    for (let x = 0; x < state.width; x++)
      targets.add(index(state, { x, y: center.y }));
    for (let y = 0; y < state.height; y++)
      targets.add(index(state, { x: center.x, y }));
  }
  return targets;
}
