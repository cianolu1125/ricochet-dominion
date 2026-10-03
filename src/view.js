export function toView(p, desktop, owner) {
  return desktop
    ? { x: 32 - p.y, y: p.x }
    : owner === 2
      ? { x: 18 - p.x, y: 32 - p.y }
      : { ...p };
}
export function fromView(p, desktop, owner) {
  return desktop
    ? { x: p.y, y: 32 - p.x }
    : owner === 2
      ? { x: 18 - p.x, y: 32 - p.y }
      : { ...p };
}
