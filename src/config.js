export const CONFIG = Object.freeze({
  width: 18,
  height: 32,
  hp: 3,
  depth: 4,
  maxTowers: 3,
  missiles: 3,
  threshold: 0.8,
  rounds: [10, 14, 18],
  optionalTurnTimer: null,
  physics: {
    minPower: 0.08,
    maxSpeed: 28,
    friction: 9,
    restitution: 0.92,
    stopSpeed: 0.5,
    radius: 0.12,
    step: 1 / 120,
  },
  rotationMs: 320,
});
export const VERSION = "0.1.0-prototype";
export const NAMES = { 1: "红方", 2: "蓝方" };
