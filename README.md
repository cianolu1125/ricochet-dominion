# 弹射领地战争 · Ricochet Dominion

Version **v0.1.0-prototype**. A mobile-first, local, turn-based ricochet territory PvP game. Two players share one device. No computer opponent, account, server, database, match save or external artwork.

## Play

- Each turn: one role action, then either up to three missiles or one tower deployment.
- Queen movement in eight straight directions. Friendly towers are passable; enemy towers and role block movement.
- Melee/dismantle requires adjacency at the start of the turn. Moving grants melee-only immunity until next own turn start.
- Each player has 3 HP. Hits respawn the role with immunity through their next turn end. Missile damage is capped at one per enemy tactical stage.
- Drag backwards from the glowing source and release to fire; precise angle/power sliders are also available. Walls and enemy towers reflect; friendly towers catch and relaunch the same shot without spending another missile. Relays are unlimited. Abandoning a caught missile causes no explosion.
- Blast paints 3×3. Towers protect 1×1, then grow on their owner's next two turn starts to 3×3 and 5×5. Maximum three towers; deployment underfoot only. Redeploy a selected slot with confirmation. Enemy protection wins against later expansion.
- Win immediately at enemy 0 HP; 80% territory at full round end; or final-round area, then HP, then towers. Equal scores get one overtime round, then compare area gains, then draw.
- Mobile portrait view flips 180° at handoff. Desktop view is fixed red-left, blue-right. Resize transposes the same 576-cell match rather than restarting it.

## Development

Node 20.19+ or 22.12+. Install: `npm ci`. Start: `npm run dev`. Validate: `npm test && npm run check && npm run build`. Output: `dist/`.

ES modules: `engine.js` is the authoritative rule state; `physics.js` supplies fixed 120Hz continuous collision steps; `view.js` maps coordinates; `renderer.js` reads state; `main.js` binds accessible DOM controls and input. All gameplay configuration is in `config.js`. Settings save only the optional sound preference locally.

## Release

Sites: https://ricochet-dominion.cianolu.chatgpt.site

Release target: GitHub `cianolu1125/ricochet-dominion`, `main`, tag `v0.1.0-prototype`. Sites source is additionally managed by its native source workflow. GitHub main updates do **not** automatically publish Sites; deploy the checked source via Sites after each release. Netlify is not configured or deployed.

Known environment limitation: no permitted browser-control QA capability was available during this build. Engine/physics/integration/DOM smoke tests and production build validation do not substitute for iOS/Android device and Safari/Edge testing. WebMCP is read-only and feature-detected; browser-native WebMCP validation is unavailable.

## Boundary decisions

No overlapping tower bodies. Respawn finds nearest safe cell if the designated cell is occupied. Equal overtime is a draw. View orientation does not guarantee a moving role remains in its starting half. Tactical skipping is explicit, while role undo is available until the first missile or tower commit. Sound is off initially. No turn timer is enforced.

See `docs/implementation-plan.md` and `CHANGELOG.md`.
