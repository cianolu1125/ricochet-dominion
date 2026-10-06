import {AI_CONFIG} from './ai-config.js';
import {CONFIG} from '../config.js';
export function rng(...parts) {
  let seed=2166136261;
  for(const c of parts.join('|')){seed^=c.charCodeAt(0);seed=Math.imul(seed,16777619);}
  return ()=>{seed+=0x6D2B79F5;let t=seed;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
}
export function normal(random) {
  return Math.sqrt(-2*Math.log(Math.max(1e-12,random())))*Math.cos(2*Math.PI*random());
}
export function perturb(decision,random,config) {
  const a=Math.atan2(decision.direction.y,decision.direction.x)+Math.max(-2.5,Math.min(2.5,normal(random)))*config.angle*Math.PI/180;
  return {...decision,direction:{x:Math.cos(a),y:Math.sin(a)},power:Math.max(CONFIG.physics.minPower,Math.min(1,decision.power+Math.max(-2.5,Math.min(2.5,normal(random)))*config.power))};
}
export function aimError(decision,session) {
  return perturb(decision,rng('execution',session.matchSeed,session.turnIndex,session.decisionIndex,session.segmentIndex,session.difficulty),AI_CONFIG[session.difficulty]||AI_CONFIG.normal);
}
export function newMatchSeed() {
  const array=new Uint32Array(1);globalThis.crypto.getRandomValues(array);return array[0];
}
