"""Continuous decay of vital stats.

Computed on read, never via a background worker, so the companion
ages naturally even when no one is polling. Floor-the-amount math
prevents tiny intervals from chipping a stat by 1 spuriously.
"""
from django.utils import timezone

from .models import Companion

DECAY_PER_MINUTE = {
    "hunger": 1.2,
    "happiness": 0.9,
    "energy": 0.7,
    "hygiene": 0.5,
}


def apply(companion: Companion, save: bool = True) -> bool:
    """Apply decay to all stats. Returns True if any stat changed."""
    now = timezone.now()
    elapsed = (now - companion.last_decay_at).total_seconds() / 60
    if elapsed <= 0:
        return False

    changed = False
    for stat, rate in DECAY_PER_MINUTE.items():
        amount = int(rate * elapsed)
        if amount <= 0:
            continue
        current = getattr(companion, stat)
        new_val = max(0, current - amount)
        if new_val != current:
            setattr(companion, stat, new_val)
            changed = True

    if changed:
        companion.last_decay_at = now
        if save:
            companion.save(update_fields=[*DECAY_PER_MINUTE.keys(), "last_decay_at"])
    return changed
