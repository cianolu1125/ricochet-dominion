// All difficulty tuning lives here. No entry changes any game rule.
export const AI_CONFIG=Object.freeze({
  easy:{nodes:260,beam:3,targets:12,bounces:1,ownLookahead:0,opponents:0,responseWeight:0,robustness:0,refine:false,angle:5.0,power:.065,inertia:2},
  normal:{nodes:1250,beam:6,targets:20,bounces:2,ownLookahead:3,opponents:0,responseWeight:0,robustness:3,refine:false,angle:2.5,power:.035,inertia:0},
  hard:{nodes:5000,beam:12,targets:32,bounces:2,ownLookahead:6,opponents:4,responseWeight:.2,robustness:7,refine:true,angle:1.0,power:.016,inertia:0},
});
export const WEIGHTS=Object.freeze({territory:2.6,stable:1.3,hp:1.8,outpost:1.2,influence:.7,pending:.6,relay:.5,safety:.4,overload:-.6,temporary:-.25});
export const TERMINAL=1_000_000;
export const MAX_TICKS=600;
export const MAX_CHAIN=6; // Five captures and final release.
export const SEARCH_TIMEOUT_MS=8000;
