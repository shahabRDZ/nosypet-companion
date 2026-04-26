"""JSON API for the React frontend."""
from __future__ import annotations

import json

from django.contrib.auth import authenticate, get_user_model, login, logout
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST
from django_ratelimit.decorators import ratelimit

from . import llm, services, sickness
from .models import Companion
from .serializers import serialize_certificate, serialize_companion

User = get_user_model()


# ---------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------

def _json(request) -> dict:
    try:
        return json.loads(request.body or b"{}")
    except json.JSONDecodeError:
        return {}


def _err(message: str, code: str = "bad_request", status: int = 400) -> JsonResponse:
    return JsonResponse({"error": code, "message": message}, status=status)


def _state_response(companion: Companion) -> dict:
    """Full companion state for game UI."""
    payload = serialize_companion(companion)
    payload.update({
        "hunger": companion.hunger,
        "happiness": companion.happiness,
        "energy": companion.energy,
        "hygiene": companion.hygiene,
        "immunity": companion.immunity,
        "is_sick": companion.is_sick,
        "disease": companion.disease,
        "symptoms": sickness.symptoms(companion),
        "severity": sickness.severity(companion),
        "is_in_coma": companion.is_in_coma,
        "hours_since_interaction": round(companion.hours_since_interaction, 2),
        "traits": {t.trait: t.value for t in companion.traits.all()},
        "archetype_locked": companion.archetype_locked or None,
        "archetype_locked_at": companion.archetype_locked_at.isoformat()
            if companion.archetype_locked_at else None,
    })
    return payload


def _ok(companion: Companion, status: int = 200) -> JsonResponse:
    return JsonResponse(_state_response(companion), status=status)


# ---------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------

@require_GET
@ensure_csrf_cookie
def csrf(request):
    return JsonResponse({"csrf_token": get_token(request)})


@require_GET
def session(request):
    if not request.user.is_authenticated:
        return JsonResponse({"authenticated": False})
    has_companion = Companion.objects.filter(owner=request.user).exists()
    return JsonResponse({
        "authenticated": True,
        "username": request.user.username,
        "has_companion": has_companion,
    })


@require_POST
@ratelimit(key="ip", rate="20/m", method="POST", block=True)
def signup(request):
    data = _json(request)
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    email = (data.get("email") or "").strip()
    if not username or not password:
        return _err("Username and password are required.")
    if len(password) < 8:
        return _err("Password must be at least 8 characters.", "weak_password")
    if User.objects.filter(username__iexact=username).exists():
        return _err("That username is already taken.", "username_taken", 409)
    user = User.objects.create_user(username=username, email=email, password=password)
    login(request, user)
    return JsonResponse({"authenticated": True, "username": user.username, "has_companion": False})


@require_POST
@ratelimit(key="ip", rate="20/m", method="POST", block=True)
def login_view(request):
    data = _json(request)
    user = authenticate(
        request,
        username=(data.get("username") or "").strip(),
        password=data.get("password") or "",
    )
    if user is None:
        return _err("Invalid credentials.", "invalid_credentials", 401)
    login(request, user)
    has_companion = Companion.objects.filter(owner=user).exists()
    return JsonResponse({
        "authenticated": True,
        "username": user.username,
        "has_companion": has_companion,
    })


@require_POST
def logout_view(request):
    logout(request)
    return JsonResponse({"authenticated": False})


# ---------------------------------------------------------------------
# Companion
# ---------------------------------------------------------------------

def _get_companion_or_404(user):
    try:
        return user.companion
    except Companion.DoesNotExist:
        return None


@login_required
@require_POST
@ratelimit(key="user", rate="3/m", method="POST", block=True)
def hatch(request):
    if Companion.objects.filter(owner=request.user).exists():
        return _err("You already have a companion.", "already_hatched", 409)
    data = _json(request)
    name = (data.get("name") or "").strip()
    if not name or len(name) > 30:
        return _err("Name must be 1-30 characters.")
    c = Companion.hatch(owner=request.user, name=name)
    return JsonResponse(serialize_companion(c), status=201)


@login_required
@require_GET
def me(request):
    c = _get_companion_or_404(request.user)
    if c is None: return _err("No companion yet.", "no_companion", 404)
    services.refresh(c)
    return _ok(c)


@login_required
@require_GET
def certificate(request):
    c = _get_companion_or_404(request.user)
    if c is None: return _err("No companion yet.", "no_companion", 404)
    return JsonResponse(serialize_certificate(c))


@login_required
@require_POST
@ratelimit(key="user", rate="6/m", method="POST", block=True)
def rename(request):
    c = _get_companion_or_404(request.user)
    if c is None: return _err("No companion yet.", "no_companion", 404)
    try:
        c = services.rename(request.user, _json(request).get("name", ""))
    except services.GameError as e:
        return _err(str(e))
    return _ok(c)


# Action helpers ------------------------------------------------------

def _action_endpoint(action_fn):
    """Wrap a service.fn into a login-required, rate-limited POST handler."""
    @login_required
    @require_POST
    @ratelimit(key="user", rate="30/m", method="POST", block=True)
    def view(request):
        c = _get_companion_or_404(request.user)
        if c is None:
            return _err("No companion yet.", "no_companion", 404)
        try:
            c = action_fn(request.user)
        except services.InComa:
            return _err("Companion is in a coma. Perform the revive ritual.", "in_coma", 409)
        except services.GameError as e:
            return _err(str(e))
        return _ok(c)
    return view


feed = _action_endpoint(services.feed)
play = _action_endpoint(services.play)
sleep = _action_endpoint(services.sleep)
pet = _action_endpoint(services.pet)
wash = _action_endpoint(services.wash)


@login_required
@require_POST
@ratelimit(key="user", rate="10/m", method="POST", block=True)
def heal(request):
    c = _get_companion_or_404(request.user)
    if c is None: return _err("No companion yet.", "no_companion", 404)
    kind = _json(request).get("kind", "medicine")
    c = services.heal(request.user, kind=kind)
    return _ok(c)


@login_required
@require_POST
@ratelimit(key="user", rate="3/m", method="POST", block=True)
def revive(request):
    c = _get_companion_or_404(request.user)
    if c is None: return _err("No companion yet.", "no_companion", 404)
    c = services.revive_from_coma(request.user)
    return _ok(c)


# Chat ----------------------------------------------------------------

@login_required
@require_POST
@ratelimit(key="user", rate="20/m", method="POST", block=True)
def chat(request):
    c = _get_companion_or_404(request.user)
    if c is None: return _err("No companion yet.", "no_companion", 404)
    services.refresh(c)
    if c.is_in_coma:
        return JsonResponse({"reply": "...", "in_coma": True})
    message = _json(request).get("message", "")
    reply = llm.speak(c, message)
    # Background-style memory extraction (still synchronous; cheap if no
    # API key, async upgrade is a Phase 4 concern).
    facts = llm.extract_memories(c, message)
    written = llm.upsert_memories(c, facts) if facts else 0
    # Trait nudge: every chat counts as a curiosity-positive interaction.
    services._apply_trait_deltas(c, services.ACTION_TRAITS["talk"])
    services._record(c, "chat", {"facts_learned": written})
    c.touch_interaction()
    c.save(update_fields=["last_interaction_at", "last_seen_at"])
    return JsonResponse({"reply": reply, "facts_learned": written, "in_coma": False})


@login_required
@require_GET
def memories(request):
    c = _get_companion_or_404(request.user)
    if c is None: return _err("No companion yet.", "no_companion", 404)
    return JsonResponse({
        "memories": [
            {"fact_type": m.fact_type, "key": m.key, "value": m.value, "confidence": m.confidence}
            for m in c.memories.order_by("-confidence", "-learned_at")[:50]
        ],
    })


# Public verification -------------------------------------------------

@require_GET
def verify(request, unique_code: str):
    try:
        c = Companion.objects.get(unique_code=unique_code.upper())
    except Companion.DoesNotExist:
        return _err("Unknown companion.", "not_found", 404)
    return JsonResponse({
        "unique_code": c.unique_code,
        "name": c.name,
        "birth_at": c.birth_at.isoformat(),
        "founder_number": c.founder_number,
        "parent_username": c.parent_username_at_birth,
        "phenotype": c.phenotype.to_dict(),
        "verified": True,
    })
