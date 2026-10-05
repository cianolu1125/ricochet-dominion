import { feedbackId } from "./feedback-events.js";
export function snapshot(s) {
  return {
    cells: [...s.cells],
    stability: [...s.stability],
    protectedBy: structuredClone(s.protectedBy),
    pending: s.cells.map((_,i)=>s.claims.find(c=>c.cells.includes(i))?.captor||0),
    towers: structuredClone(s.towers),
    claims: structuredClone(s.claims),
  };
}
export function visualChanges(s, before, events, time, reduced, transitions) {
  if (!before) return events;
  const cross = events.find((e) => e.type === "cross");
  const impact =
    events.find((e) => e.type === "siege") ||
    events.find((e) => e.type === "blast");
  const strategic = events.find(e=>["takeoverComplete","takeoverStart","reclaim","overload","shielded","restore"].includes(e.type));
  const groupId = strategic?.groupId || impact?.groupId || feedbackId();
  const extras = [];
  const emit = (type, position, meta = {}) =>
    extras.push({
      type,
      ...position,
      owner: s.current,
      eventId: feedbackId(),
      groupId,
      ...meta,
    });
  const removed = before.towers.filter(
      (t) => !s.towers.some((n) => n.id === t.id),
    ),
    added = s.towers.filter((t) => !before.towers.some((o) => o.id === t.id));
  for (const t of removed)
    if (impact?.type !== "siege")
      emit(
        (t.owner === s.current && added.length) || strategic?.type === "takeoverStart" ? "redeploy" : "destroy",
        { x: t.pos.x + 0.5, y: t.pos.y + 0.5 },
        { owner: t.owner },
      );
  for (const t of added)
    emit("build", { x: t.pos.x + 0.5, y: t.pos.y + 0.5 }, { owner: t.owner });
  const grown=s.towers.filter(t=>before.towers.some(o=>o.id===t.id && o.owner===t.owner &&
    o.state!=='overloaded' && o.state!=='contested' &&
    (o.stage<t.stage || (t.influence||[]).some(i=>!(o.influence||o.protected).includes(i)))));
  for(const t of grown) {
    const old=before.towers.find(o=>o.id===t.id),previous=new Set(old.influence||old.protected);
    const cells=(t.influence||t.protected).filter(i=>!previous.has(i));
    emit('grow',{x:t.pos.x+.5,y:t.pos.y+.5},{owner:t.owner,cells,width:s.width,stage:t.stage});
  }
  const claims = before.claims.filter(
    (c) => !s.claims.some((n) => n.id === c.id) && c.captor === s.current,
  );
  const source = claims
    .flatMap((c) => c.sources)
    .map((id) => s.towers.find((t) => t.id === id))
    .find(Boolean);
  const anchor = strategic || impact ||
    (added[0] && { x: added[0].pos.x + 0.5, y: added[0].pos.y + 0.5 }) ||
    (source && { x: source.pos.x + 0.5, y: source.pos.y + 0.5 }) ||
    (removed[0] && {
      x: removed[0].pos.x + 0.5,
      y: removed[0].pos.y + 0.5,
    }) || {
      x: s.players[s.current].pos.x + 0.5,
      y: s.players[s.current].pos.y + 0.5,
    };
  const changed = [],
    disconnected = [],
    reconnected = [];
  for (let i = 0; i < s.cells.length; i++) {
    if (before.cells[i] !== s.cells[i]) changed.push(i);
    if (
      before.cells[i] === s.cells[i] &&
      before.stability[i] === "stable" &&
      s.stability[i] === "temporary"
    )
      disconnected.push(i);
    if (
      before.cells[i] === s.cells[i] &&
      before.stability[i] === "temporary" &&
      s.stability[i] === "stable"
    )
      reconnected.push(i);
  }
  if (disconnected.length) emit("disconnect", anchor);
  if (reconnected.length) emit("reconnect", anchor);
  const converted = changed.filter(
    (i) =>
      claims.some((c) => c.cells.includes(i)) ||
      events.some((e) => e.type === "convert" && e.cells?.includes(i)),
  );
  if (converted.length && !events.some((e) => e.type === "convert"))
    emit("convert", anchor, { size: converted.length });
  const waveCells = new Set(changed);
  for (const t of grown) {
    const old = before.towers.find((o) => o.id === t.id);
    for (const i of t.protected)
      if (!old.protected.includes(i)) waveCells.add(i);
  }
  if (impact)
    for (
      let y = Math.floor(impact.y) - impact.radius;
      y <= Math.floor(impact.y) + impact.radius;
      y++
    )
      for (
        let x = Math.floor(impact.x) - impact.radius;
        x <= Math.floor(impact.x) + impact.radius;
        x++
      ) {
        const i = y * s.width + x;
        if (
          x >= 0 &&
          x < s.width &&
          y >= 0 &&
          y < s.height &&
          (!s.protectedBy[i]?.length || s.cells[i] === s.current)
        )
          waveCells.add(i);
      }
  const protectionChanged=s.cells.map((_,i)=>i).filter(i=>Boolean(before.protectedBy?.[i]?.length)!==Boolean(s.protectedBy[i]?.length));
  const pendingChanged=s.cells.map((_,i)=>i).filter(i=>(before.pending?.[i]||0)!==(s.claims.find(c=>c.cells.includes(i))?.captor||0));
  const cells = new Set([...waveCells, ...disconnected, ...reconnected, ...protectionChanged, ...pendingChanged]);
  const distance = (i, a) =>
    Math.hypot((i % s.width) + 0.5 - a.x, Math.floor(i / s.width) + 0.5 - a.y);
  const maxDistance = Math.max(
    1,
    ...[...cells].map((i) => distance(i, anchor)),
  );
  for (const i of cells) {
    const colorChanged = before.cells[i] !== s.cells[i],
      wave = waveCells.has(i) && (colorChanged || grown.some(t=>t.protected.includes(i)));
    let a = anchor,
      delay;
    if (!impact && !converted.includes(i) && grown.length) {
      a = grown
        .map((t) => ({ x: t.pos.x + 0.5, y: t.pos.y + 0.5 }))
        .sort((a, b) => distance(i, a) - distance(i, b))[0];
    }
    if (!colorChanged && !wave) {
      delay=(distance(i,anchor)/maxDistance)*(disconnected.includes(i)?150:80);
    } else if (cross) {
      const d = Math.max(
        Math.abs((i % s.width) + 0.5 - cross.x),
        Math.abs(Math.floor(i / s.width) + 0.5 - cross.y),
      );
      const reach = Math.max(
        cross.x,
        cross.width - cross.x,
        cross.y,
        cross.height - cross.y,
      );
      delay = (d / Math.max(1, reach)) * 220;
    } else if (impact) {
      const dx = Math.abs((i % s.width) + 0.5 - anchor.x),
        dy = Math.abs(Math.floor(i / s.width) + 0.5 - anchor.y);
      delay =
        impact.radius === 1
          ? dx && dy
            ? 65
            : dx || dy
              ? 32
              : 0
          : Math.max(dx, dy) * 65 + (impact.type === "siege" ? 50 : 0);
    } else
      delay = converted.includes(i)
        ? (distance(i, a) / maxDistance) * 270
        : Math.min(80, distance(i, a) * 18);
    if(grown.some(t=>t.protected.includes(i)) && !impact && !strategic && !reduced)delay+=100;
    transitions.set(i, {
      from: before.cells[i],
      to: s.cells[i],
      fromTemporary: before.stability[i] === "temporary",
      toTemporary: s.stability[i] === "temporary",
      born: time,
      delay: reduced ? 0 : delay,
      duration: reduced ? 90 : wave ? 340 : disconnected.includes(i) ? 300 : 280,
      fromProtected: Boolean(before.protectedBy?.[i]?.length),
      fromPending: before.pending?.[i] || 0,
      wave,
      soft: !impact && !converted.includes(i),
    });
  }
  return [...events, ...extras];
}
