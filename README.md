# NosyPet · AI Companion v2

Adopt a unique AI companion. Each one is born from a 64-bit DNA seed
that drives every visible trait. The first 100 adopters get a permanent
Founder mark on their birth certificate.

## Phases

| Phase | Status | What it ships |
|-------|--------|---------------|
| 1. Foundation & Identity | done | Auth, DNA, atomic founder counter, birth certificate, public verification endpoint |
| 2. 2D World & Behavior | done | PixiJS room, procedural creature driven by DNA, behavior tree, particles, touch |
| 3. AI Mind | next | LLM dialogue, structured memory, trait scoring, archetype lock at day 14, sickness |
| 4. Polish & Launch | later | PWA, push notifications, sound, deploy |

## Stack

- **Backend** Django 5 + Postgres-ready (SQLite locally), `django-ratelimit`, CSRF, CORS
- **Frontend** React 19 + Vite + TypeScript + Zustand + React Router + PixiJS 8

## Local development

```bash
# Backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver

# Frontend (in another terminal)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and adopt a companion.

## Architecture

### DNA system (`backend/companion/dna.py`)

A pure function maps a 64-bit seed to a `Phenotype`: body color, eye
color, pattern, ear shape, tail style, size modifier, temperament,
talent, and a 64-float fingerprint used for the certificate art.

The seed is the only thing stored. Phenotype is recomputed on demand,
keeping storage tiny and giving us provable reproducibility: anyone can
verify a published seed produces the claimed look.

### Procedural creature (`frontend/src/game/Creature.ts`)

A `PIXI.Container` of layered `Graphics` objects, each shape derived
from the phenotype. Pattern, ear shape, and tail style each have their
own renderer. The same class plays distinct keyframe animations for
walk, eat, sleep, sneeze, fart, and so on. When real sprite art is
ready, swap this class for a sprite-backed one with the same surface.

### Behavior tree (`frontend/src/game/BehaviorTree.ts`)

A minimal Selector / Sequence / Action / Condition / Cooldown / RandomChance
implementation. The runtime in `Game.ts` builds a tree that prioritizes
high-priority needs (eat, sleep), then occasional spontaneous actions
(fart, sneeze, yawn, scratch, look at camera, chase tail), then a default
wander loop.

### Atomic founder counter

`Companion.hatch()` runs inside `transaction.atomic()` and locks the
table to claim the next founder slot under `FOUNDER_LIMIT`. Slots are
permanent: a deleted companion does not free up a number.

### Public verification

`/api/verify/<unique_code>/` returns minimal public info about any
companion. The certificate page links here so anyone can confirm the
companion's authenticity without needing access to the owner's account.

## Tests

```bash
cd backend && python manage.py test
```

Covers DNA determinism, hatch atomicity, founder limit enforcement,
signup, the hatch + certificate flow, the rename guard, and the public
verify endpoint.
