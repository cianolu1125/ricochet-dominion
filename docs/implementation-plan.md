# Ricochet Dominion Implementation Plan

Goal: ship the approved v1.0 document as v0.1.0-prototype, local two-player only, GitHub main and Sites, no Netlify.

Architecture: plain ES modules, Vite, one authoritative game state. Canvas reads state; DOM controls call validated engine actions. Fixed-step physics uses board units. View transforms never mutate game coordinates.

Spec: 弹射领地战争_开发规格_v1.0.docx (2026-10-03). Its latest rules replace earlier conversation proposals.

## Constraints and decisions

- 18×32 canonical grid, transpose its view to 32×18 on desktop. Initial four rows per side, 3 HP, 3 towers, 3 missiles, 3×3 blast, 80% at full Round only; 10/14/18 rounds.
- Movement grants melee-only protection until next own Turn start. Respawn immunity until next own Turn end. Melee and dismantle require adjacency at Turn start.
- Towers protect cells through explicit membership sets; new growth skips enemy protected cells. Removing one overlapping tower preserves other towers' protection.
- One body per tower cell; building on one's existing tower is unavailable. Redeployment validates before deleting anything.
- Respawn cell occupied by enemy role/tower: choose nearest unoccupied cell to original spawn, deterministic row/column tie break. Spawn is never forcibly recolored.
- Drawing orientation follows viewport, without resetting the match. A player's starting side remains its side; movement may carry their role elsewhere.
- One overtime Round, compare area change after checking HP/80%; a still equal result is a draw.
- No game persistence, no server, no turn timer by default; config reserves optionalTurnTimer.

## Tasks

1. Rules: src/config.js, engine.js; tests/engine.test.js. APIs createGame, moveRole, melee, dismantle, buildTower, growTowers, explode, endTurn, undoRole. Verify protection lifecycle, growth conflicts, overlap/redeploy, phase gates, Round/HP/area winners and draw.
2. Physics/view: src/physics.js, view.js; tests/physics.test.js. APIs launch, stepMissile, abandon, toView/fromView. Verify wall/tower reflection, own-tower capture repeated without extra ammo, origin clearance, collision ordering, fps-independent steps and rotation inversion.
3. UI: index.html, src/main.js, renderer.js, style.css. Start screen, rules, two-player status, eight movement rays, undo, tactical selection, re-deploy confirmation, slingshot dragging, relay, pass-device overlay, results/rematch, sound preference, reduced motion and keyboard access.
4. Release: npm test/check/build; README and CHANGELOG; tag v0.1.0-prototype; package/push Sites; synchronize exact source to GitHub main. No Netlify.

## Review focus

- Resize during flight/rotation: input inverse uses current view; no reset.
- Tower at launcher: ignore origin only until exiting, allow reentry.
- Hidden tab: pause simulation, never catch up unlimited elapsed time.
- Invalid/duplicate actions: reject without state mutation.
- Respawn occupied: deterministic safe cell, no two entities overlapping.

Each engine/physics task follows failing regression tests → implementation → green suite. UI verified through syntax/build and available preview infrastructure. Final rule and code review before publishing.

## Release rulings and evidence

- User explicitly authorized implementation without another design/plan approval. Native implementation used; final read-only reviewer invoked by the review skill.
- Respawn immunity ends on active melee as well as dismantling, consistent with offensive protection cancellation. Visible rules clarify this; alternative would permit protected offensive melee.
- Public Sites access follows the approved document’s explicit public-access release criterion.
- Browser-control capability unavailable: DOM emulation verifies interaction state but cannot verify real rendered layout or physical-device touch behavior.
- Review found two navigation defects (Escape from home rules, resize after result → home); regressions reproduced both before fixes.
- Task1/2 complete: engine and physics tests 20/20. Task3 complete: full-match plus DOM tests, reviewer completed. No unresolved rule-critical findings.
