// Relative offsets and durations fit existing cues. No separate clock or AudioContext.
const layer=(start,end,gain,offset=0,length=1,type='sine')=>({start,end,gain,offset,length,type});
const recipes={
 ui:[layer(260,90,.65,0,.62,'triangle'),layer(720,480,.12,.12,.5)],
 launch:[layer(65,160,.55,0,.35),layer(240,70,.38,.3,.7)],
 fire:[layer(60,180,.42,0,.3),layer(280,58,.48,.3,.7),layer(730,310,.09,.35,.4)],
 bounce:[layer(380,190,.61,0,.8),layer(1040,580,.22,.03,.65)],
 capture:[layer(70,220,.50,0,.62),layer(410,310,.34,.35,.65)],
 carry:[layer(180,110,.62),layer(510,330,.22,.1,.75)],
 land:[layer(160,50,.76,0,.85,'triangle')],
 damage:[layer(115,38,.75),layer(580,140,.13,0,.32,'triangle')],
 blast:[layer(100,28,.72),layer(340,70,.21,.06,.72,'triangle')],
 destroy:[layer(145,32,.62),layer(430,90,.24,.02,.55,'triangle'),layer(68,26,.13,.15,.85)],
 siege:[layer(82,24,.64),layer(320,65,.20,.02,.55,'triangle'),layer(52,22,.15,.12,.88)],
 build:[layer(180,65,.38,0,.3,'triangle'),layer(450,310,.25,.24,.35),layer(95,55,.32,.52,.48)],
 grow:[layer(80,44,.72),layer(260,180,.13,.1,.7)],
 disconnect:[layer(360,85,.75),layer(600,120,.15,0,.65)],
 reconnect:[layer(130,300,.65),layer(420,540,.19,.2,.7)],
 convert:[layer(100,380,.56),layer(420,250,.24,.12,.7)],
 redeploy:[layer(440,150,.44,0,.5),layer(160,60,.40,.45,.55,'triangle')],
 handoff:[layer(210,140,.62,0,.65,'triangle'),layer(460,330,.18,.15,.6)],
 complete:[layer(210,310,.43),layer(310,410,.28,.28,.65),layer(510,510,.18,.55,.4)],
 charge:[layer(120,360,.75)],cross:[layer(180,65,.58),layer(530,180,.29,.06,.83)],
 overload:[layer(240,55,.62),layer(490,100,.25,.04,.6,'triangle')],
 shielded:[layer(410,600,.62,0,.65),layer(840,510,.22,.12,.6)],
 takeoverStart:[layer(250,320,.43),layer(360,260,.43)],
 takeoverComplete:[layer(340,75,.26,0,.35),layer(210,420,.61,.28,.72)],
 reclaim:[layer(160,380,.64),layer(430,310,.23,.18,.7)],
 restore:[layer(160,340,.62),layer(450,510,.22,.23,.7)],
 ultimateFlight:[layer(48,95,.61),layer(180,110,.25,.1,.8)],
 ultimateCrack:[layer(510,150,.63,0,.8),layer(940,280,.24,.06,.55)],
 // Last 50ms of the absorption cue stays silent; impact starts at its existing cue.
 ultimateCharge:[layer(70,170,.42,0,.8),layer(220,430,.31,.18,.62),layer(390,620,.18,.36,.44)],
 ultimateBlast:[layer(75,24,.61),layer(310,55,.25,.02,.58,'triangle'),layer(48,22,.13,.2,.8)],
 ultimatePurge:[layer(390,90,.60),layer(760,210,.24,.08,.75)],
 ultimateDamage:[layer(95,28,.72),layer(390,130,.17,0,.42,'triangle')],
};
const levels=[
 [layer(120,340,.74)],
 [layer(100,380,.49),layer(240,530,.30,.12,.82)],
 [layer(70,330,.41,0,.82),layer(180,510,.31,.12,.7),layer(350,680,.21,.27,.55)],
];
export function covenAudioBank(original){
 return Object.fromEntries(Object.entries(original).map(([event,voice])=>[event,{
 voice:[recipes[event][0].start,recipes[event][0].end,voice[2],voice[3]*.9],
 material:'ritual',noiseCutoff:['siege','destroy'].includes(event)?620:480,
 layers:recipes[event],...(event==='charge'?{levels}:{})
 }]));
}
