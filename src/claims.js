// Dynamic membership is refreshed only after authoritative map transactions.
// Historical cells locate surviving regions; they never limit claim area.
export function refreshClaims(state, neighbors) {
  const regionFor = new Map(),
    seen = new Set();
  for (let i = 0; i < state.cells.length; i++) {
    if (seen.has(i) || state.stability[i] !== "temporary") continue;
    const owner = state.cells[i],
      cells = [i];
    seen.add(i);
    for (let n = 0; n < cells.length; n++)
      for (const j of neighbors(state, cells[n]))
        if (
          !seen.has(j) &&
          state.cells[j] === owner &&
          state.stability[j] === "temporary"
        ) {
          seen.add(j);
          cells.push(j);
        }
    for (const j of cells) regionFor.set(j, cells);
  }
  const live = new Set(state.towers.map((t) => t.id));
  state.claims = state.claims.filter((claim) => {
    claim.sources = [...new Set(claim.sources)].filter((id) => live.has(id));
    if (!claim.sources.length) return false;
    const regions = new Set(
      claim.cells
        .filter((i) => state.cells[i] === claim.target)
        .map((i) => regionFor.get(i))
        .filter(Boolean),
    );
    claim.cells = [...new Set([...regions].flat())];
    return claim.cells.length > 0;
  });
}
