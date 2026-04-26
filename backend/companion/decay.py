"""Continuous decay (and growth) of vital stats.

Computed on read, never via a background worker. While the companion
is sleeping, energy regenerates instead of draining and most other
stats decay more slowly. Bladder always fills over time; an accident
fires when it reaches 100 without being relieved.
"""
from django.utils import timezone

from .models import BehaviorEvent, Companion

DECAY_PER_MINUTE = {
    "hunger": 1.2,
    "happiness": 0.9,
    "energy": 0.7,
    "hygiene": 0.5,
}

# How fast bladder pressure rises (points per minute).
BLADDER_FILL_PER_MINUTE = 0.8

# Sleep regenerates energy at this rate per minute.
ENERGY_REGEN_PER_MINUTE = 1.6


def apply(companion: Companion, save: bool = True) -> bool:
    """Apply continuous changes. Returns True if any field changed."""
    now = timezone.now()
    elapsed_minutes = (now - companion.last_decay_at).total_seconds() / 60
    if elapsed_minutes <= 0:
        return False

    changed = False

    # Stat decay or, if sleeping, attenuated decay.
    sleeping = companion.is_sleeping
    for stat, base_rate in DECAY_PER_MINUTE.items():
        rate = base_rate * (0.4 if sleeping and stat != "hygiene" else 1.0)
        amount = int(rate * elapsed_minutes)
        if amount <= 0:
            continue
        current = getattr(companion, stat)
        # Energy *grows* during sleep instead of shrinking.
        if stat == "energy" and sleeping:
            new_val = min(100, current + int(ENERGY_REGEN_PER_MINUTE * elapsed_minutes))
        else:
            new_val = max(0, current - amount)
        if new_val != current:
            setattr(companion, stat, new_val)
            changed = True

    # Bladder fills always (even during sleep).
    bladder_amount = int(BLADDER_FILL_PER_MINUTE * elapsed_minutes)
    if bladder_amount > 0:
        new_b = min(100, companion.bladder + bladder_amount)
        if new_b != companion.bladder:
            companion.bladder = new_b
            changed = True

    # Auto-wake if energy fully restored.
    if sleeping and companion.energy >= 100:
        companion.is_sleeping = False
        companion.sleep_started_at = None
        BehaviorEvent.objects.create(
            companion=companion, event_type="auto_wake", detail={},
        )
        changed = True

    # Accident: bladder hit 100 without being relieved.
    if companion.bladder >= 100:
        companion.bladder = 0
        companion.hygiene = max(0, companion.hygiene - 30)
        companion.happiness = max(0, companion.happiness - 15)
        BehaviorEvent.objects.create(
            companion=companion, event_type="accident", detail={},
        )
        changed = True

    if changed:
        companion.last_decay_at = now
        if save:
            companion.save(update_fields=[
                "hunger", "happiness", "energy", "hygiene",
                "bladder", "is_sleeping", "sleep_started_at",
                "last_decay_at",
            ])
    return changed
