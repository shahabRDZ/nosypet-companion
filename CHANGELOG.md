# Changelog

## [v1.0.0] · Phase 4 ready · 2026-04

The full four-phase product:

### Phase 1 · Foundation & Identity
- Django backend, DNA system, atomic founder counter (1-100),
  birth certificate with portrait + fingerprint art + PNG export,
  public verification endpoint.

### Phase 2 · 2D World & Behavior
- React + Vite + TypeScript shell.
- PixiJS 8 procedural creature, every shape derived from the DNA seed.
- Behavior tree with selectors, sequences, cooldowns, random chances.
- Spontaneous quirks: fart, sneeze, yawn, scratch, look at camera,
  chase tail. Wander loop as default.
- Procedural particle system (hearts, food, ZZZ, sparkles, fart smoke).
- Day / night cycle in the room, drifting clouds, sun and moon.
- Touch input: tap nuzzles, long-press pets.

### Phase 3 · AI Mind
- Server-authoritative stats with continuous decay on read.
- Sickness catalogue with hygiene-driven probability and tiered symptoms.
- Service layer with `transaction.atomic` + `select_for_update`.
- 5-trait personality system with archetype lock at day 14.
- Coma instead of permanent death. Revive ritual: 60 long presses
  in 5 minutes. 20% of low-confidence memories drop on revive.
- Claude Haiku 4.5 wrapper with prompt caching for system prompts;
  graceful fallback when no API key is configured.
- Live polling hook with visibility-aware pausing.
- Chat box, trait panel, archetype reveal modal, coma overlay.

### Phase 4 · Production, Polish & Launch
- Installable PWA via vite-plugin-pwa with Workbox precache + runtime
  caching for the state endpoint and Google fonts.
- Manifest with all standard icon sizes plus a maskable variant,
  generated from the SVG with sharp.
- Procedural sound system via Web Audio API: nuzzle, eat, play, sleep,
  pet, heal, sneeze, level up, hatch, error. No assets needed.
- Sound mute toggle in the topbar. Auto-unlock on first gesture.
- Onboarding overlay (first-visit, dismissible, remembered in
  localStorage).
- Install prompt banner (handles Android via beforeinstallprompt and
  iOS via Add-to-Home-Screen hint).
- ErrorBoundary on the root tree.
- Procfile, runtime.txt, render.yaml, railway.json, GitHub Actions CI.
- LICENSE (MIT) and CHANGELOG.

## Test status
- 18 backend tests passing.
- Frontend builds cleanly (PWA + 20 precache entries).
