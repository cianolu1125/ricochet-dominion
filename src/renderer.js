import {currentTheme} from './themes/theme-manager.js';
import {protectedTile,towerCore,player,projectile} from './themes/geometry.js';
import { relayStatus } from "./engine.js";
import { tilePresentation } from "./feedback.js";
import { drawEffects } from "./effects.js";
import { toView } from "./view.js";
import { origin, previewImpact } from "./physics.js";
import { regionContours } from "./region-outline.js";
import { layoutBattlefieldLabel } from "./battlefield-labels.js";
export const TEAM = { get 1(){return currentTheme().team[1]}, get 2(){return currentTheme().team[2]} };
const FILL = {get 0(){return currentTheme().board[0]},get 1(){return currentTheme().board[1]},get 2(){return currentTheme().board[2]}};
let cachedTheme,RGB;
function syncColors(){const theme=currentTheme();if(theme!==cachedTheme){cachedTheme=theme;RGB=Object.fromEntries(Object.entries(theme.board).map(([owner,hex])=>[owner,[1,3,5].map(n=>parseInt(hex.slice(n,n+2),16))]));}}
function blend(from, to, progress) {
  return `rgb(${RGB[from].map((n, i) => Math.round(n + (RGB[to][i] - n) * progress)).join(",")})`;
}
export function render(canvas, s, v) {
  syncColors();
  const theme=currentTheme(),themed=theme.id!=="original";
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const width = canvas.clientWidth || parseFloat(canvas.style.width) || 360,
    height = canvas.clientHeight || parseFloat(canvas.style.height) || 640,
    dpr = canvas.width / width,
    tile = v.viewport?.tile || width / s.width;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.translate(
    (v.viewport?.x || 0) + (v.shake?.x || 0),
    (v.viewport?.y || 0) + (v.shake?.y || 0),
  );
  ctx.scale(tile, tile);
  if(v.camera?.focus) {
    const focus=toView(v.camera.focus,s,v.owner),zoom=v.camera.zoom||1;
    ctx.translate(s.width/2,s.height/2);ctx.scale(zoom,zoom);
    ctx.translate(-focus.x,-focus.y);
  }
  ctx.translate(s.width / 2, s.height / 2);
  ctx.rotate(v.rotation || 0);
  ctx.translate(-s.width / 2, -s.height / 2);
  const pt = (p) => toView(p, s, v.owner),
    circle = (p, r, color, line = false) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      if (line) {
        ctx.strokeStyle = color;
        ctx.stroke();
      } else {
        ctx.fillStyle = color;
        ctx.fill();
      }
    };
  const pending = new Map();
  for (const c of s.claims)
    for (const i of c.cells)
      if (s.cells[i] === c.target && s.stability[i] === "temporary")
        pending.set(i, c.captor);
  for (let y = 0; y < s.height; y++)
    for (let x = 0; x < s.width; x++) {
      const i = y * s.width + x,
        o = s.cells[i],
        p = pt({ x: x + 0.5, y: y + 0.5 });
      const transition = v.transitions?.get(i);
      const progress = transition
        ? Math.max(
            0,
            Math.min(
              1,
              (v.time - transition.born - transition.delay) /
                transition.duration,
            ),
          )
        : 1;
      const show = transition
        ? tilePresentation(transition, v.time, v.reduced)
        : { progress: 1, owner: o, lift: 0, scale: 1 };
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(show.scale, show.scale);
      ctx.translate(-p.x, -p.y - show.lift * (transition?.soft ? 0.045 : 0.1));
      const temporary =
        transition && show.progress < 0.7
          ? transition.fromTemporary
          : s.stability[i] === "temporary";
      const targetAlpha = 1,
        fromAlpha = 1;
      if (show.lift > 0) {
        ctx.globalAlpha = show.lift * 0.3;
        ctx.fillStyle = "#020a12";
        ctx.fillRect(p.x - 0.48, p.y - 0.45 + show.lift * 0.14, 0.96, 0.96);
      }
      ctx.globalAlpha = fromAlpha + (targetAlpha - fromAlpha) * progress;
      ctx.fillStyle = transition
        ? transition.wave && !v.reduced
          ? FILL[show.owner]
          : blend(transition.from, o, progress)
        : FILL[o];
      ctx.fillRect(p.x - 0.484, p.y - 0.484, 0.968, 0.968);
      if (show.lift > 0) {
        ctx.strokeStyle = (TEAM[show.owner] || "#9bc7f0") + "55";
        ctx.lineWidth = 0.015;
        ctx.strokeRect(p.x - 0.48, p.y - 0.48, 0.96, 0.96);
      }
      ctx.globalAlpha = 1;
      if (temporary) {
        // Static, rotation-safe dark tile with two hand-drawn inner shadow corners.
        ctx.fillStyle='#05080b33';ctx.fillRect(p.x-.484,p.y-.484,.968,.968);
        ctx.strokeStyle='#05080ba6';ctx.lineWidth=Math.max(.045,1.25/tile);
        ctx.beginPath();
        ctx.moveTo(p.x-.12,p.y-.35);ctx.lineTo(p.x-.35,p.y-.35);ctx.lineTo(p.x-.35,p.y-.10);
        ctx.moveTo(p.x+.12,p.y+.35);ctx.lineTo(p.x+.35,p.y+.35);ctx.lineTo(p.x+.35,p.y+.10);ctx.stroke();
      }
      const hasProtection=Boolean(s.protectedBy[i]?.length);
      const protection=transition && transition.fromProtected!==undefined ? Number(transition.fromProtected)+(Number(hasProtection)-Number(transition.fromProtected))*progress : Number(hasProtection);
      if(protection>0) {
        ctx.save();ctx.globalAlpha=protection;
        ctx.strokeStyle=TEAM[show.owner]+'88';ctx.lineWidth=Math.max(.025,.8/tile);
        if(themed)protectedTile(ctx,p,theme,tile);else ctx.strokeRect(p.x-.35,p.y-.35,.70,.70);
        ctx.restore();
      }
      if(!pending.has(i) && transition?.fromPending && progress<1)pending.set(i,transition.fromPending);
      ctx.restore();
    }
  const placedLabels=[];
  const label=(text,p,color)=>{
    if(!text)return;
    const font=Math.max(.46,9/tile);
    ctx.save();ctx.font='600 '+font+'px system-ui';
    const w=ctx.measureText(text).width||text.length*font*.72;
    const position=layoutBattlefieldLabel(s,p,v.rotation||0,w,font,placedLabels);
    placedLabels.push(position);
    // Cancel board rotation around the board center; the label itself is now
    // drawn in the same upright screen coordinates used by the bounds check.
    ctx.translate(s.width/2,s.height/2);ctx.rotate(-(v.rotation||0));ctx.translate(-s.width/2,-s.height/2);
    ctx.translate(position.x,position.y);
    ctx.fillStyle=color;ctx.textAlign='left';
    ctx.fillText(text,0,0);ctx.restore();
  };
  const drawRegion=(cells,kind,owner,withLabel=false)=>{
    if(!cells.length)return;
    const contours=regionContours(s,cells);
    const path=()=>{
      ctx.beginPath();
      for(const points of contours){const a=pt(points[0]);ctx.moveTo(a.x,a.y);
        for(const point of points.slice(1)){const b=pt(point);ctx.lineTo(b.x,b.y);}}
    };
    ctx.save();ctx.lineWidth=Math.max(.025,.85/tile);ctx.lineJoin='round';
    if(kind==='overload') {
      ctx.strokeStyle=TEAM[owner]+'99';ctx.setLineDash([.22,.16]);
      ctx.lineDashOffset=v.reduced?0:-v.time/8000*.38;path();ctx.stroke();
    } else {
      ctx.strokeStyle='#d3d9d060';path();ctx.stroke();
      ctx.lineWidth=Math.max(.035,1/tile);ctx.setLineDash([.24,.24]);
      const offset=v.reduced?0:-v.time/6500*.48;
      for(const team of [1,2]){ctx.strokeStyle=TEAM[team]+'88';ctx.lineDashOffset=offset+(team===2?.24:0);path();ctx.stroke();}
    }
    ctx.restore();
    if(withLabel){const points=contours.flat().map(pt),top=Math.min(...points.map(p=>p.y));
      const right=Math.max(...points.filter(p=>p.y===top).map(p=>p.x));
      label(v.contestedLabel||'CONTESTED',{x:right+.1,y:top-.2},'#d7e2ea');}
  };
  const regions=new Map();
  for(const [i,owner] of pending){if(!regions.has(owner))regions.set(owner,[]);regions.get(owner).push(i);}
  for(const [owner,cells] of regions)drawRegion(cells,'contested',owner,true);
  for(const t of s.towers) {
    if(t.state==='overloaded')drawRegion(t.influence||[],'overload',t.owner);
    if(t.state==='contested')drawRegion(t.influence||[],'contested',t.owner);
  }
  for (const t of s.towers) {
    const building = v.effects.find(
      (e) =>
        e.type === "build" && e.x === t.pos.x + 0.5 && e.y === t.pos.y + 0.5,
    );
    if (building && v.time - building.born < 140 && !v.reduced) continue;
    const p = pt({ x: t.pos.x + 0.5, y: t.pos.y + 0.5 }),
      selected =
        v.select && (v.selectIds || []).includes(t.id);
    const overload=t.state==='overloaded', contested=t.state==='contested';
    if(themed)towerCore(ctx,p,t,theme);else{
    ctx.fillStyle = "#11212f";
    ctx.fillRect(p.x - 0.35, p.y - 0.35, 0.7, 0.7);
    ctx.strokeStyle = TEAM[t.owner];
    ctx.lineWidth = 0.065;
    ctx.setLineDash([]);
    ctx.globalAlpha=overload?.6:1;
    if(overload) {
      for(const [dx,dy] of [[-1,-1],[1,1]]){ctx.beginPath();ctx.moveTo(p.x+dx*.1,p.y+dy*.33);ctx.lineTo(p.x+dx*.33,p.y+dy*.33);ctx.lineTo(p.x+dx*.33,p.y+dy*.1);ctx.stroke();}
    }else ctx.strokeRect(p.x-.33,p.y-.33,.66,.66);
    ctx.globalAlpha=1;
    ctx.setLineDash([]);
    ctx.fillStyle = TEAM[t.owner] + (overload ? "40" : "77");
    ctx.fillRect(p.x - 0.13, p.y - 0.13, 0.26, 0.26);
    }
    const relay = relayStatus(s, t);
    if (relay === "available") {
      ctx.save();ctx.globalAlpha=.82;ctx.strokeStyle=themed?theme.colors.accent:TEAM[t.owner];
      ctx.lineWidth=Math.max(.035,1.1/tile);
      for(const [r,period,dir] of [[.57,4800,1],[.69,6000,-1]]) {
        const orbit=v.reduced?-.8:dir*v.time/period*Math.PI*2;
        ctx.beginPath();ctx.arc(p.x,p.y,r,orbit,orbit+Math.PI*.65);ctx.stroke();
      }
      ctx.restore();
    }
    const captured = v.effects.find(e =>
      (e.type === "capture" || e.type === "charge") &&
      e.x === t.pos.x + 0.5 && e.y === t.pos.y + 0.5 &&
      v.time - e.born >= 0 && v.time - e.born < 160);
    if (captured && !v.reduced) {
      const q = (v.time - captured.born) / 160;
      circle(p, 0.57 * (1 - q) + 0.1 * q, TEAM[t.owner], true);
    }
    if (relay === "used") {
      ctx.strokeStyle = TEAM[t.owner] + "66";
      ctx.lineWidth = 0.025;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 0.52, 0.25, Math.PI * 1.65);
      ctx.stroke();
    }
    if(overload) {
      ctx.strokeStyle=TEAM[t.owner]+'80';ctx.lineWidth=Math.max(.025,.9/tile);
      const orbit=v.reduced?0:v.time/8000*Math.PI*2;
      for(let n=0;n<3;n++) {
        const angle=n*Math.PI*2/3+.2+orbit;
        ctx.beginPath();ctx.arc(p.x,p.y,.62,angle,angle+1.15);ctx.stroke();
      }
      label(v.labels?.overload||'OVERLOAD',{x:p.x+.65,y:p.y+.86},TEAM[t.owner]);
    }
    if(contested) {
      ctx.lineWidth=Math.max(.035,1.1/tile);
      for(const [owner,r,dir,start] of [[1,.69,1,.15],[2,.79,-1,Math.PI+.15]]) {
        const angle=start+(v.reduced?0:dir*v.time/5500*Math.PI*2);
        ctx.strokeStyle=TEAM[owner];ctx.beginPath();ctx.arc(p.x,p.y,r,angle,angle+2.15);ctx.stroke();
      }
      label(v.contestedLabel||'CONTESTED',{x:p.x+.85,y:p.y-.5},'#d7e2ea');
    }
    ctx.strokeStyle=TEAM[t.owner]+'99';
    for (let n = 0; n < (overload ? 0 : t.stage); n++) {
      const r = 0.43 + n * 0.11;
      ctx.lineWidth = 0.03;
      for (const [dx, dy] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        ctx.beginPath();
        ctx.moveTo(p.x + dx * r, p.y + dy * (r - 0.14));
        ctx.lineTo(p.x + dx * r, p.y + dy * r);
        ctx.lineTo(p.x + dx * (r - 0.14), p.y + dy * r);
        ctx.stroke();
      }
    }
    if (selected) {
      const replacing=v.select==='redeploy'||v.select==='takeover-replace';
      ctx.save();ctx.lineWidth=Math.max(.03,1/tile);
      if(replacing){ctx.setLineDash([.14,.12]);ctx.lineDashOffset=v.reduced?0:-v.time/2000;ctx.strokeStyle=TEAM[t.owner]+'b0';ctx.strokeRect(p.x-.59,p.y-.59,1.18,1.18);}
      else {const a=v.reduced?0:v.time/1900*Math.PI*2;ctx.strokeStyle=TEAM[t.owner];ctx.beginPath();ctx.arc(p.x,p.y,.78,a,a+Math.PI*4/3);ctx.stroke();}
      ctx.restore();
      ctx.save();
      ctx.translate(p.x, p.y - 0.8);
      ctx.rotate(-(v.rotation || 0));
      ctx.fillStyle = TEAM[t.owner];
      ctx.font = "700 .55px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(t.slot, 0, 0);
      ctx.restore();
    }
  }
  for (const owner of [1, 2]) {
    const role = s.players[owner];
    if (role.hp <= 0) continue;
    const w = role.world || { x: role.pos.x + 0.5, y: role.pos.y + 0.5 },
      p = pt(w);
    if (s.activeBody?.carried === owner) {
      const m = s.activeBody,
        len = Math.hypot(m.vx, m.vy) || 1;
      const offset = pt({
        x: w.x - (m.vx / len) * 0.38,
        y: w.y - (m.vy / len) * 0.38,
      });
      p.x = offset.x;
      p.y = offset.y;
    }
    if(themed){
      const dir=s.profile==='desktop'?(owner===1?1:-1):(owner===v.owner?-1:1);
      player(ctx,p,owner,s,v,theme,dir);continue;
    }
    ctx.lineWidth = 0.08;
    circle(p, 0.34, "#0d1c29");
    const hurt = v.effects.find(
      (e) => e.type === "damage" && e.owner === owner && v.time - e.born < 110,
    );
    ctx.lineWidth =
      hurt && !v.reduced
        ? 0.08 + Math.sin((v.time - hurt.born) * 0.3) * 0.02
        : 0.08;
    circle(p, 0.3, hurt ? "#eff8ff" : TEAM[owner], true);
    const healed = v.effects.find(e => e.type === "heal" && e.owner === owner && v.time - e.born < 500);
    if (healed) {
      const age = v.time - healed.born, strength = Math.min(1, age / 100) * Math.max(0, 1 - Math.max(0, age - 300) / 200);
      ctx.save();
      ctx.globalAlpha = strength * 0.8;
      ctx.lineWidth = 0.045;
      circle(p, 0.4, "#a1ebbd", true);
      ctx.restore();
    }
    if (owner !== s.current && v.opponentFocus) {
      ctx.lineWidth = 0.025;
      circle(p, 0.48, TEAM[owner] + "55", true);
    }
    const flashed = v.effects.some(
      (e) => e.type === "damage" && e.owner === owner && v.time - e.born < 90,
    );
    circle(p, 0.21, flashed ? "#edf4f8" : TEAM[owner] + "44");
    ctx.fillStyle = TEAM[owner];
    ctx.beginPath();
    const dir =
      s.profile === "desktop"
        ? owner === 1
          ? 1
          : -1
        : owner === v.owner
          ? -1
          : 1;
    if (s.profile === "desktop") {
      ctx.moveTo(p.x + dir * 0.2, p.y);
      ctx.lineTo(p.x - dir * 0.12, p.y - 0.13);
      ctx.lineTo(p.x - dir * 0.12, p.y + 0.13);
    } else {
      ctx.moveTo(p.x, p.y + dir * 0.2);
      ctx.lineTo(p.x - 0.13, p.y - dir * 0.12);
      ctx.lineTo(p.x + 0.13, p.y - dir * 0.12);
    }
    ctx.fill();
    if (owner === s.current) {
      ctx.lineWidth = 0.025;
      circle(p, 0.53, TEAM[owner] + "66", true);
    }
  }
  if (s.phase.includes("AIM")) {
    const p = pt(origin(s));
    ctx.lineWidth = 0.05;
    circle(
      p,
      0.68 + Math.sin(v.reduced ? 0 : v.time / 180) * 0.04,
      TEAM[s.current] + "a0",
      true,
    );
    if (s.phase.startsWith("MISSILE") && s.charge > 0) {
      for (let n = 0; n < Math.min(2, s.charge); n++)
        circle(p, 0.4 + n * 0.1, TEAM[s.current] + "80", true);
      ctx.save();
      ctx.translate(p.x + 0.8, p.y - 0.6);
      ctx.rotate(-(v.rotation || 0));
      ctx.fillStyle = TEAM[s.current];
      ctx.font = "700 .5px system-ui";
      ctx.fillText(["", "Ⅰ", "Ⅱ", "Ⅲ"][s.charge], 0, 0);
      ctx.restore();
    }
    if (v.aim) {
      const aim = v.aim,
        len = Math.hypot(aim.x, aim.y) || 1,
        worldEnd = {
          x: origin(s).x + (aim.x / len) * (1 + aim.power * 4),
          y: origin(s).y + (aim.y / len) * (1 + aim.power * 4),
        },
        end = pt(worldEnd);
      ctx.strokeStyle = v.cancelArmed ? theme.colors.red : TEAM[s.current];
      ctx.lineWidth = 0.075;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.save();
      ctx.translate(end.x, end.y);
      ctx.rotate(Math.atan2(end.y - p.y, end.x - p.x));
      ctx.fillStyle = v.cancelArmed ? theme.colors.red : TEAM[s.current];
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-0.3, -0.16);
      ctx.lineTo(-0.3, 0.16);
      ctx.fill();
      ctx.restore();
      const hit = previewImpact(s, aim, aim.power);
      if (
        hit &&
        Math.hypot(hit.x - origin(s).x, hit.y - origin(s).y) <=
          1 + aim.power * 4
      ) {
        const hp = pt(hit);
        ctx.lineWidth = 0.05;
        circle(hp, 0.22, "#eaf2f6", true);
      }
      ctx.beginPath();
      ctx.arc(
        p.x,
        p.y,
        0.85,
        -Math.PI / 2,
        -Math.PI / 2 + aim.power * 2 * Math.PI,
      );
      ctx.stroke();
    }
  }
  const m = s.activeBody;
  if (m) {
    for (
      let n = Math.max(0, m.trail.length - (m.charge === 3 ? 10 : 7));
      n < m.trail.length;
      n++
    ) {
      ctx.globalAlpha = ((n + 1) / m.trail.length) * 0.5;
      circle(pt(m.trail[n]), 0.04 + (m.charge || 0) * 0.016, themed ? (theme.id==='coven' ? theme.colors.text : theme.colors.accent) : TEAM[s.current]);
    }
    ctx.globalAlpha = 1;
    if (m.kind === "missile") {
      const p = pt(m),
        f = pt({ x: m.x + m.vx, y: m.y + m.vy });
      if(themed)projectile(ctx,p,Math.atan2(f.y-p.y,f.x-p.x),m.charge,theme);
      else{
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.atan2(f.y - p.y, f.x - p.x));
      ctx.fillStyle = "#f1f6fa";
      ctx.beginPath();
      ctx.moveTo(0.22, 0);
      ctx.lineTo(-0.16, -0.13);
      ctx.lineTo(-0.16, 0.13);
      ctx.fill();
      ctx.restore();
      if (m.charge === 3) {
        ctx.lineWidth = 0.03;
        circle(p, 0.35, TEAM[s.current] + "a0", true);
      }
      }
      if (m.carried) {
        const p2 = pt({ x: m.x, y: m.y });
        ctx.strokeStyle = TEAM[m.carried] + "88";
        ctx.lineWidth = 0.035;
        circle(p2, 0.5, TEAM[m.carried] + "88", true);
      }
    }
  }
  drawEffects(ctx, v.effects, v.time, pt, TEAM, v.reduced, v.rotation || 0, v.labels);
  if(v.camera?.dim || v.camera?.exposure) {
    ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.globalAlpha=v.camera.exposure||v.camera.dim;
    ctx.fillStyle=v.camera.exposure?(themed?theme.colors.flash:'#eef7ff'):(themed?theme.colors.bg:'#02070e');ctx.fillRect(0,0,width,height);ctx.restore();
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
