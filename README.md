# NosyPet · AI Companion

Adopt a unique AI companion. Every one is born from a 64-bit DNA seed
that drives appearance and temperament. They grow over 14 days into a
locked archetype based on how you interact with them. They walk around
their room, get sick, can fall into a coma if neglected, and remember
things you tell them.

## Status

| Phase | What it ships |
|-------|---------------|
| 1. Foundation & Identity | Auth, DNA, atomic founder counter (1-100), birth certificate, public verification endpoint |
| 2. 2D World & Behavior | PixiJS room, procedural creature driven by DNA, behavior tree, particles, touch |
| 3. AI Mind | Stats, sickness, traits, archetype lock at day 14, coma + revive ritual, Claude Haiku dialogue, structured memory |
| 4. Production, Polish & Launch | PWA, sounds, onboarding, install banner, error boundary, deploy configs, CI |

All four phases are merged into `main`.

## Stack

- **Backend** Django 5 · Postgres-ready · django-ratelimit · CORS · Anthropic SDK
- **Frontend** React 19 · Vite · TypeScript · Zustand · React Router · PixiJS 8 · Workbox PWA

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
npm install --legacy-peer-deps
npm run dev
```

Open http://localhost:5173 and adopt a companion.

### Optional: enable Claude dialogue

Without an API key the chat box uses canned fallback lines. To turn on
the real LLM:

```bash
cd backend
echo 'ANTHROPIC_API_KEY=sk-ant-...' >> .env
# Restart `manage.py runserver`
```

## Deploy

The repo ships with three deployment configs:

- **Railway** (`railway.json`)
- **Render** (`render.yaml`, defines two services + a Postgres database)
- **Heroku-like** platforms (`backend/Procfile` + `backend/runtime.txt`)

Set these environment variables in the platform dashboard:

| Variable | Purpose |
|----------|---------|
| `DJANGO_SECRET_KEY` | Required, generated value recommended |
| `DJANGO_DEBUG` | Set to `False` |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated hostnames |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | Comma-separated frontend origins |
| `DATABASE_URL` | Postgres URL (free tier is enough to start) |
| `CORS_ALLOWED_ORIGINS` | Frontend origin |
| `ANTHROPIC_API_KEY` | Optional, for live LLM |

## Testing

```bash
cd backend && python manage.py test       # 18 tests
cd frontend && npm run build              # type-check + bundle + PWA
```

CI runs both on every push and PR (see `.github/workflows/ci.yml`).

## Architecture highlights

### DNA system
A pure function (`backend/companion/dna.py`) turns a 64-bit seed into
a `Phenotype`: body color, eye color, pattern, ear shape, tail style,
size, temperament, talent, and a 64-float fingerprint. The seed is the
only thing stored. Everything else is recomputed on demand.

### Procedural creature
`frontend/src/game/Creature.ts` builds the on-screen companion entirely
from `PIXI.Graphics` shapes derived from the phenotype. Pattern, ear
shape, and tail style each have a renderer. When real sprite art arrives
later, the same surface (`update`, `playAction`, `setPosition`) lets us
swap implementations without touching the rest of the app.

### Behavior tree
Minimal Selector / Sequence / Action / Condition / Cooldown / RandomChance
in `frontend/src/game/BehaviorTree.ts`. The runner in `Game.ts` defines
the priority list of autonomous behaviors plus the wander loop.

### Server-authoritative state
The frontend polls `/api/companion/me/` every 7 seconds while visible.
All mutating actions (feed, play, sleep, pet, wash, heal, revive,
chat, rename) run inside `transaction.atomic` with `select_for_update`,
write a `BehaviorEvent`, apply trait deltas, and return the full state.

### Personality
Five traits, scored by behavior events. At day 14 the archetype is
locked permanently. A neglected companion (no interaction for 7 days)
slips into coma; the owner reverses it via a long-press ritual that
fades 20% of low-confidence memories.

### LLM
`backend/companion/llm.py` wraps Claude Haiku 4.5 with prompt caching
on the system block. Two operations: `speak()` and `extract_memories()`,
both gracefully degrade to canned lines when no API key is configured.

### Verifiable identity
Anyone can call `/api/verify/<NP-XXXX-YYYY>/` to confirm a companion
exists with the claimed appearance. No login required. The certificate
page links here so a screenshot or shared image is provably real.

## License

MIT. See `LICENSE`.
