export const VERSION = "0.5.1";
export const NAMES = { 1: "红方", 2: "蓝方" };
export const PROFILES = {
  phone: [18, 32],
  tablet: [24, 32],
  "touch-landscape": [32, 24],
  desktop: [32, 18],
};
export const CONFIG = Object.freeze({
  hp: 10,
  deployHeal: 1,
  maxTowers: 5,
  threshold: 0.8,
  rounds: [10, 14, 18],
  initialTowerStage: 2,
  rotationMs: 400,
  physics: {
    minPower: 0.08,
    maxSpeed: 28,
    friction: 9,
    restitution: 0.92,
    stopSpeed: 0.5,
    radius: 0.12,
    roleRadius: 0.31,
    step: 1 / 120,
  },
});
