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

// Canvas remains full viewport. Fit the board camera above the overlay gesture area.
export function battlefieldViewport(s, width, height, dock = 64) {
  const area = camera(s, Math.max(1,width-24), Math.max(1,height-dock-24));
  return {...area,x:(width-area.width)/2,y:12+Math.max(0,(height-dock-24-area.height)/2)};
}
