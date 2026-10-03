export const toView = (p, s, owner) =>
  s.profile !== "desktop" && owner === 2
    ? { x: s.width - p.x, y: s.height - p.y }
    : { x: p.x, y: p.y };
export const fromView = toView;
export function camera(s, width, height) {
  const tile = Math.min(width / s.width, height / s.height);
  return { tile, width: s.width * tile, height: s.height * tile };
}
export function profileFor(width, height, touch) {
  if (!touch) return "desktop";
  if (Math.min(width, height) < 600) return "phone";
  return width > height ? "touch-landscape" : "tablet";
}
