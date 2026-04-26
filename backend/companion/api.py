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


# ---------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------

@require_GET
@ensure_csrf_cookie
def csrf(request):
    """Hand the SPA a CSRF cookie. Must be called once before any POST."""
    return JsonResponse({"csrf_token": get_token(request)})


@require_GET
def session(request):
    """Returns the current session state for the SPA."""
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
# Companion lifecycle
# ---------------------------------------------------------------------

@login_required
@require_POST
@ratelimit(key="user", rate="3/m", method="POST", block=True)
def hatch(request):
    """Create a new companion for the current user. One per user."""
    if Companion.objects.filter(owner=request.user).exists():
        return _err("You already have a companion.", "already_hatched", 409)

    data = _json(request)
    name = (data.get("name") or "").strip()
    if not name:
        return _err("Name is required.")
    if len(name) > 30:
        return _err("Name must be 30 characters or fewer.")

    c = Companion.hatch(owner=request.user, name=name)
    return JsonResponse(serialize_companion(c), status=201)


@login_required
@require_GET
def me(request):
    try:
        c = request.user.companion
    except Companion.DoesNotExist:
        return _err("No companion yet.", "no_companion", 404)
    return JsonResponse(serialize_companion(c))


@login_required
@require_GET
def certificate(request):
    try:
        c = request.user.companion
    except Companion.DoesNotExist:
        return _err("No companion yet.", "no_companion", 404)
    return JsonResponse(serialize_certificate(c))


@login_required
@require_POST
@ratelimit(key="user", rate="6/m", method="POST", block=True)
def rename(request):
    try:
        c = request.user.companion
    except Companion.DoesNotExist:
        return _err("No companion yet.", "no_companion", 404)
    data = _json(request)
    name = (data.get("name") or "").strip()
    if not name or len(name) > 30:
        return _err("Name must be 1-30 characters.")
    c.name = name
    c.save(update_fields=["name"])
    return JsonResponse(serialize_companion(c))


# ---------------------------------------------------------------------
# Public verification endpoint
# ---------------------------------------------------------------------

@require_GET
def verify(request, unique_code: str):
    """Public endpoint anyone can call to verify a certificate's authenticity.

    Returns minimal public info, never the owner's email or session data.
    """
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
