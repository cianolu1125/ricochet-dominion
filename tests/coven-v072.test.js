import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {themes,audioEvents,visualEvents} from '../src/themes/theme-registry.js';
import {flavor} from '../src/themes/theme-ui.js';
import {themeManager} from '../src/themes/theme-manager.js';
test('COVEN sealed-wax palette and immutable presentation tokens',()=>{
 const t=themes.coven;
 assert.equal(t.colors.bg,'#08070B');assert.equal(t.colors.red,'#B44F63');assert.equal(t.colors.blue,'#668AA8');
 for(const key of ['redHi','blueHi','redDeep','blueDeep','border','heal'])assert.match(t.colors[key],/^#[0-9A-Fa-f]{6}$/);
 assert.equal(t.ui.actionShape,'ritual-hex');assert.ok(Object.isFrozen(t.tiles));assert.ok(Object.isFrozen(t.fx));
 for(const event of visualEvents)assert.ok(t.vfx[event]);
});
test('symmetric painted menu retains rectangular pointer target',()=>{
 const css=readFileSync('src/themes/themes.css','utf8');
 assert.ok(!css.includes('border-radius:8px 8px 2px 2px'));
 assert.match(css,/\[data-theme="coven"\] #stack button::before/);
 assert.match(css,/pointer-events:none/);
 themeManager.request('coven');try{for(const key of ['redeploy','takeover','reclaim','back'])assert.ok(flavor(key,'en'));}finally{themeManager.request('original')}
});
test('all COVEN sounds are authored layers with bounded gain and existing cue duration',()=>{
 for(const name of audioEvents){const r=themes.coven.audio[name];assert.ok(r.layers?.length,name);assert.equal(r.voice[2],themes.original.audio[name].voice[2]);
 assert.ok(r.layers.reduce((n,l)=>n+l.gain,0)<=1.05,name);for(const l of r.layers)assert.ok(l.offset+l.length<=1.001,name);}
 const charge=themes.coven.audio.charge;assert.equal(charge.levels.length,3);assert.ok(charge.levels[2].length>charge.levels[0].length);
});
import * as geometry from '../src/themes/geometry.js';
function drawing(){const calls=[],ctx=new Proxy({},{get(o,k){return (...args)=>{assert.ok(args.every(a=>typeof a!=='number'||Number.isFinite(a)),String(k));calls.push([k,...args]);};},set(o,k,v){calls.push(['set',k,v]);return true}});return {ctx,calls};}
test('broken seal and recent ribbon are presentation-only and bounded',()=>{
 assert.equal(typeof geometry.unstableTile,'function');assert.equal(typeof geometry.arcaneRibbon,'function');
 const a=drawing();geometry.unstableTile(a.ctx,{x:1,y:1},themes.coven,20);assert.ok(a.calls.filter(c=>c[0]==='lineTo').length>=6);
 const trail=[{x:1,y:1},{x:2,y:1},{x:3,y:1},{x:3,y:2},{x:3,y:3}],before=structuredClone(trail),b=drawing();
 geometry.arcaneRibbon(b.ctx,trail,{x:3,y:3.2},3,themes.coven,1,p=>p);assert.deepEqual(trail,before);
 assert.ok(!b.calls.some(c=>c[0]==='lineTo'&&c[1]<3));assert.ok(b.calls.length<80);
});
import {drawThemeEvent} from '../src/themes/event-effects.js';
test('ritual impact has bone core, team outer circle and cross afterglow',()=>{
 const {ctx,calls}=drawing();let budget=40;
 drawThemeEvent(ctx,{type:'blast',owner:1,radius:1,charge:0},{x:2,y:3},.36,110,themes.coven,false,()=>budget-->0,p=>p);
 assert.ok(calls.some(c=>c[0]==='set'&&c[1]==='strokeStyle'&&c[2]===themes.coven.colors.text));
 assert.ok(calls.some(c=>c[0]==='set'&&c[1]==='strokeStyle'&&c[2]===themes.coven.team[1]));
 assert.ok(calls.filter(c=>c[0]==='arc').length>=3);
});
test('charge levels converge 12/18/26 particles within one shared budget',()=>{
 const sizes=[];for(const level of [1,2,3]){const {ctx,calls}=drawing();let budget=40;
 drawThemeEvent(ctx,{type:'charge',charge:level,owner:2},{x:1,y:2},.4,140,themes.coven,false,()=>budget-->0,p=>p);sizes.push(calls.filter(c=>c[0]==='fillRect').length);}
 assert.deepEqual(sizes,[12,18,26]);
});
test('COVEN action surfaces retain absolute placement and reset inherited icon margins',()=>{
 const css=readFileSync('src/themes/themes.css','utf8');const rule=css.match(/html\[data-theme="coven"\] #stack button\{([^}]+)\}/)[1];
 assert.ok(!rule.includes('position:relative'));assert.match(css,/z-index:-1;pointer-events:none;margin:0/);
});
test('reduced cross retains every real arm and protected endpoint within its budget',()=>{
 const {ctx,calls}=drawing();let budget=24;
 const e={type:'cross',owner:1,x:15.5,y:15.5,width:32,ends:[{x:.5,y:15.5},{x:30.5,y:15.5},{x:15.5,y:.5},{x:15.5,y:30.5}],shielded:[16*32+15]};
 drawThemeEvent(ctx,e,{x:e.x,y:e.y},.4,160,themes.coven,true,()=>budget-->0,p=>p);
 const points=calls.filter(c=>c[0]==='translate');
 for(const end of e.ends)assert.ok(points.some(c=>Math.abs(c[1]-end.x)<.01&&Math.abs(c[2]-end.y)<.01),JSON.stringify(end));
 assert.ok(points.some(c=>c[1]===15.5&&c[2]===16.5),'protected seal retained');assert.ok(budget>=0,'budget respected');
});
test('COVEN role uses short highlight and symmetric ritual needle',()=>{
 const {ctx,calls}=drawing();geometry.player(ctx,{x:1,y:2},1,{profile:'phone',current:1},{time:80,effects:[{type:'fire',owner:1,born:0}]},themes.coven,1);
 assert.ok(calls.some(c=>c[0]==='set'&&c[1]==='strokeStyle'&&c[2]===themes.coven.colors.redHi));
 assert.ok(calls.some(c=>c[0]==='lineTo'&&c[1]===0&&c[2]===-.13));
});
test('larger COVEN controls paint symmetric cut corners without clipping buttons',()=>{
 const css=readFileSync('src/themes/themes.css','utf8');assert.match(css,/\[data-theme="coven"\] #panel button:not\(\.theme-card\)::before/);
 const rules=[...css.matchAll(/html\[data-theme="coven"\] #panel button:not\(\.theme-card\)\{([^}]+)\}/g)].map(m=>m[1]);assert.ok(rules.every(r=>!r.includes('clip-path')));
});
