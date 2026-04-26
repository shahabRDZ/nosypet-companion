"""Action services.

All mutations go through here so traits, behavior events, and stat
clamping stay consistent. Each action is wrapped in `transaction.atomic`
with `select_for_update` on the companion row.
"""
from __future__ import annotations

from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from . import decay, sickness
from .models import (
    ARCHETYPE_RULES,
    BehaviorEvent,
    Companion,
    CompanionTrait,
    TRAIT_KEYS,
)

NEGLECT_COMA_DAYS = 7
HEAL_COIN_COST = 0  # coins were a v1 concept; heal is free in v2 (skill-based ritual)

# Trait deltas per action. Positive moves toward 100, negative toward -100.
ACTION_TRAITS = {
    "feed":   {"affection": 1, "discipline": 1},
    "play":   {"playfulness": 2},
    "sleep":  {"discipline": 1},
    "pet":    {"affection": 1},
    "heal":   {"affection": 2},
    "talk":   {"curiosity": 1},
    "neglect_24h": {"affection": -2, "confidence": -1},
    "scold":  {"discipline": 2, "affection": -1, "confidence": -1},
    "toilet": {"discipline": 2},
    "wake":   {"affection": -1},
}


class GameError(Exception):
    """Base for service-level errors."""


class InComa(GameError):
    pass


class TooFull(GameError):
    pass


class IsSleeping(GameError):
    pass


class NotSleeping(GameError):
    pass


def _clamp(value: int, lo: int = 0, hi: int = Companion.STAT_MAX) -> int:
    return max(lo, min(hi, value))


def _locked_companion(user) -> Companion:
    return Companion.objects.select_for_update().get(owner=user)


def _record(companion: Companion, event_type: str, detail: dict | None = None) -> None:
    BehaviorEvent.objects.create(
        companion=companion,
        event_type=event_type,
        detail=detail or {},
    )


def _apply_trait_deltas(companion: Companion, deltas: dict[str, int]) -> None:
    for key, delta in deltas.items():
        if key not in TRAIT_KEYS:
            continue
        trait, _ = CompanionTrait.objects.get_or_create(
            companion=companion, trait=key, defaults={"value": 0},
        )
        trait.value = _clamp(trait.value + delta, lo=-100, hi=100)
        trait.save(update_fields=["value", "updated_at"])


def _update_archetype_lock(companion: Companion) -> bool:
    """If 14 days have passed and the archetype is not yet locked,
    snapshot it now. Returns True on the moment of locking."""
    if companion.archetype_locked:
        return False
    if companion.age_days < 14:
        return False
    traits = {t.trait: t.value for t in companion.traits.all()}
    for name, predicate in ARCHETYPE_RULES:
        if predicate(traits):
            companion.archetype_locked = name
            break
    else:
        companion.archetype_locked = "strange_one"
    companion.archetype_locked_at = timezone.now()
    companion.save(update_fields=["archetype_locked", "archetype_locked_at"])
    return True


def _check_neglect_coma(companion: Companion) -> bool:
    """If the companion was abandoned, slip into coma. Returns True if
    coma was newly entered."""
    if companion.is_in_coma:
        return False
    if companion.hours_since_interaction >= NEGLECT_COMA_DAYS * 24:
        companion.is_in_coma = True
        companion.coma_started_at = timezone.now()
        companion.save(update_fields=["is_in_coma", "coma_started_at"])
        _record(companion, "entered_coma", {})
        return True
    return False


# ---------------------------------------------------------------------
# Read-side refresh
# ---------------------------------------------------------------------

def refresh(companion: Companion) -> Companion:
    """Apply decay, sickness check, neglect-coma check. Idempotent."""
    decay.apply(companion, save=True)
    sickness.maybe_recover(companion, save=True)
    sickness.maybe_catch_disease(companion, save=True)
    _check_neglect_coma(companion)
    _update_archetype_lock(companion)
    return companion


# ---------------------------------------------------------------------
# Actions (locked + transactional)
# ---------------------------------------------------------------------

def _start_action(user, *, allow_in_coma: bool = False) -> Companion:
    companion = _locked_companion(user)
    decay.apply(companion, save=False)
    if companion.is_in_coma and not allow_in_coma:
        raise InComa()
    return companion


@transaction.atomic
def feed(user) -> Companion:
    c = _start_action(user)
    if c.is_sleeping:
        raise IsSleeping()
    if c.hunger >= 90:
        raise TooFull()
    c.hunger = _clamp(c.hunger + 25)
    c.energy = _clamp(c.energy + 5)
    c.touch_interaction()
    c.save()
    _apply_trait_deltas(c, ACTION_TRAITS["feed"])
    _record(c, "feed", {})
    return c


@transaction.atomic
def play(user) -> Companion:
    c = _start_action(user)
    if c.is_sleeping:
        raise IsSleeping()
    c.happiness = _clamp(c.happiness + 25)
    c.hunger = _clamp(c.hunger - 10)
    c.energy = _clamp(c.energy - 15)
    c.touch_interaction()
    c.save()
    _apply_trait_deltas(c, ACTION_TRAITS["play"])
    _record(c, "play", {})
    return c


@transaction.atomic
def sleep(user) -> Companion:
    """Enter persistent sleep state. Returns immediately; the companion
    keeps sleeping in the background (energy regens, mood-stats decay
    slowly) until wake() is called or energy hits 100."""
    c = _start_action(user)
    if c.is_sleeping:
        return c  # idempotent
    c.is_sleeping = True
    c.sleep_started_at = timezone.now()
    c.touch_interaction()
    c.save()
    _apply_trait_deltas(c, ACTION_TRAITS["sleep"])
    _record(c, "sleep", {})
    return c


@transaction.atomic
def wake(user) -> Companion:
    """Tap to wake. Slight affection penalty if cut short while energy
    is still low (companion is grumpy)."""
    c = _locked_companion(user)
    if not c.is_sleeping:
        raise NotSleeping()
    cut_short = c.energy < 60
    c.is_sleeping = False
    c.sleep_started_at = None
    c.touch_interaction()
    c.save()
    if cut_short:
        _apply_trait_deltas(c, ACTION_TRAITS["wake"])
    _record(c, "wake", {"cut_short": cut_short})
    return c


@transaction.atomic
def toilet(user) -> Companion:
    """Take the companion to the toilet. Resets bladder pressure and
    grants a discipline boost. Cannot be done while sleeping."""
    c = _start_action(user)
    if c.is_sleeping:
        raise IsSleeping()
    relieved = c.bladder
    c.bladder = 0
    c.happiness = _clamp(c.happiness + 5)
    c.touch_interaction()
    c.save()
    _apply_trait_deltas(c, ACTION_TRAITS["toilet"])
    _record(c, "toilet", {"relieved": relieved})
    return c


@transaction.atomic
def scold(user) -> Companion:
    """Mild discipline action. Companion drops happiness/affection but
    learns. Useful after an accident or repeated misbehaviour."""
    c = _start_action(user)
    if c.is_sleeping:
        raise IsSleeping()
    c.happiness = _clamp(c.happiness - 8)
    c.touch_interaction()
    c.save()
    _apply_trait_deltas(c, ACTION_TRAITS["scold"])
    _record(c, "scold", {})
    return c


@transaction.atomic
def pet(user) -> Companion:
    c = _start_action(user)
    c.happiness = _clamp(c.happiness + 5)
    c.touch_interaction()
    c.save()
    _apply_trait_deltas(c, ACTION_TRAITS["pet"])
    _record(c, "pet", {})
    return c


@transaction.atomic
def wash(user) -> Companion:
    c = _start_action(user)
    c.hygiene = _clamp(c.hygiene + 40)
    c.happiness = _clamp(c.happiness - 5)  # most don't love bath time
    c.touch_interaction()
    c.save()
    _apply_trait_deltas(c, {"discipline": 1})
    _record(c, "wash", {})
    return c


@transaction.atomic
def heal(user, kind: str = "medicine") -> Companion:
    """Treat a sick or comatose companion. Different items have
    different efficacies. Always touches interaction so neglect timer
    resets."""
    c = _start_action(user, allow_in_coma=True)

    boost = {"medicine": 30, "soup": 20, "vet": 60}.get(kind, 20)
    if c.disease:
        # Reduce illness by clearing it if vet, else shorten duration.
        if kind == "vet":
            c.disease = ""
            c.disease_started_at = None
            c.immunity = _clamp(c.immunity + 10)
        else:
            c.immunity = _clamp(c.immunity + 3)
    c.hunger = _clamp(c.hunger + boost // 2)
    c.energy = _clamp(c.energy + boost)
    c.happiness = _clamp(c.happiness + boost // 2)
    c.hygiene = _clamp(c.hygiene + boost // 4)
    c.touch_interaction()
    c.save()
    _apply_trait_deltas(c, ACTION_TRAITS["heal"])
    _record(c, "heal", {"kind": kind})
    return c


@transaction.atomic
def revive_from_coma(user) -> Companion:
    """The 'ritual': owner spent 60 long-pet interactions in 5 minutes.
    Frontend tallies the gestures and calls this once when satisfied.
    Backend does NOT verify the gesture count; that is a frontend
    responsibility for V1. We do mark a small memory penalty."""
    c = _locked_companion(user)
    if not c.is_in_coma:
        return c
    c.is_in_coma = False
    c.coma_started_at = None
    c.hunger = _clamp(c.hunger + 50)
    c.happiness = _clamp(c.happiness + 60)
    c.energy = _clamp(c.energy + 50)
    c.hygiene = _clamp(c.hygiene + 30)
    c.touch_interaction()
    c.save()

    # Soft memory loss: drop the 20% lowest-confidence facts.
    memories = list(c.memories.order_by("confidence")[: max(1, c.memories.count() // 5)])
    for m in memories:
        m.delete()

    _record(c, "revive", {"forgotten_count": len(memories)})
    return c


@transaction.atomic
def rename(user, new_name: str) -> Companion:
    c = _locked_companion(user)
    cleaned = (new_name or "").strip()
    if not cleaned or len(cleaned) > 30:
        raise GameError("Invalid name.")
    c.name = cleaned
    c.touch_interaction()
    c.save(update_fields=["name", "last_interaction_at", "last_seen_at"])
    _record(c, "rename", {"new_name": cleaned})
    return c
