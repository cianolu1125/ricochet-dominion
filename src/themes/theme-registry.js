import {originalVoices} from './audio-recipes.js';
export const audioEvents=Object.keys(originalVoices);
export const visualEvents=['ui','launch','fire','bounce','capture','carry','land','damage','blast','destroy','siege','build','grow','disconnect','reconnect','convert','redeploy','handoff','complete','charge','cross','overload','shielded','takeoverStart','takeoverComplete','reclaim','restore','charge3Ultimate','heal'];
const groups={ui:'touch',launch:'air',fire:'string',bounce:'metal',capture:'glass',carry:'air',land:'stone',damage:'drum',blast:'impact',destroy:'stone',siege:'impact',build:'wood',grow:'drum',disconnect:'air',reconnect:'glass',convert:'glass',redeploy:'wood',handoff:'touch',complete:'glass',charge:'glass',cross:'string',overload:'stone',shielded:'metal',takeoverStart:'glass',takeoverComplete:'impact',reclaim:'wood',restore:'glass',ultimateFlight:'air',ultimateCrack:'metal',ultimateCharge:'drum',ultimateBlast:'impact',ultimatePurge:'air',ultimateDamage:'drum'};
function audioBank(id){
 return Object.fromEntries(audioEvents.map(event=>{
  const base=originalVoices[event],material=groups[event];
  if(id==='original')return [event,{voice:base,material:'original'}];
  const coven=id==='coven';
  const pitch={touch:coven?.65:.48,air:coven?.58:.85,string:coven?.60:1.12,metal:coven?1.22:.78,glass:coven?.8:.92,wood:coven?.68:.72,stone:coven?.65:.62,drum:coven?.75:.55,impact:coven?.72:.70}[material];
  return [event,{voice:[base[0]*pitch,Math.max(24,base[1]*pitch),base[2],base[3]*.9],material,
   waveform:coven?'sine':'triangle',partials:coven?[1,2.76,4.12]:[1,1.49,2.03],noiseCutoff:coven?780:1450}];
 }));
}
function freeze(o){Object.values(o).forEach(v=>{if(v&&typeof v==='object')freeze(v)});return Object.freeze(o)}
function define(id,meta,colors){return freeze({id,meta,colors,team:{1:colors.red,2:colors.blue},board:{0:colors.neutral,1:colors.redFill,2:colors.blueFill},audio:audioBank(id),vfx:Object.fromEntries(visualEvents.map(event=>[event,{event,geometry:id==='coven'?'sigil':id==='tang'?'seal':'original',accent:colors.accent,flash:colors.flash}]))})}
export const themes=freeze({
 original:define('original',{zh:'原典',en:'Original',tag:'ORIGINAL',description:['当前战术科技风','Precision tactical technology'],subtitle:['战术 · 科技 · 弹射','TACTICAL / RICOCHET']},{bg:'#101b26',panel:'#11212f',text:'#e6eef5',muted:'#a6b9c8',red:'#efaaa2',blue:'#9bc7f0',accent:'#9bc7f0',flash:'#eff8ff',neutral:'#253542',redFill:'#66454e',blueFill:'#355976'}),
 coven:define('coven',{zh:'女巫契约',en:'The Coven',tag:'COVEN',description:['中世纪秘术与禁忌仪式','Black iron, moonlight and ritual'],subtitle:['女巫契约 · 黑月仪式','THE COVEN / BLACK MOON']},{bg:'#0B0A0F',panel:'#171813',text:'#D8CEB1',muted:'#a39b87',red:'#CF7377',blue:'#8BB4CE',accent:'#A89568',flash:'#eee6cd',neutral:'#282829',redFill:'#654044',blueFill:'#354e61'}),
 tang:define('tang',{zh:'大唐山河',en:'Tang Dominion',tag:'TANG',description:['军阵、金石、朱砂与石青','Fort seals, bronze and mineral color'],subtitle:['大唐 · 山河局','TANG / MOUNTAINS & RIVERS']},{bg:'#17140F',panel:'#241D17',text:'#E2D2AD',muted:'#ad9d80',red:'#DB8167',blue:'#8CBBBB',accent:'#C3A05A',flash:'#f4e5b8',neutral:'#302c25',redFill:'#684337',blueFill:'#375653'})
});
export const getTheme=id=>themes[id]||themes.original;
export function visualRecipe(theme,event){return theme.vfx[event]||themes.original.vfx[event]||null;}
export function audioRecipe(theme,event){return theme.audio[event]||themes.original.audio[event]||null;}
