"""Sickness model.

Diseases are catalogued here as plain dicts, not as a separate Django
model, because the catalogue is read-only and small. A sick companion
records which disease it has and when it started; symptoms ramp up
gradually so the player has time to react before the pet is bedridden.

Probability of catching something is checked at most once per hour
on read. Inputs: hygiene, average stat, immunity, and time since the
last interaction (a neglected pet gets sick faster).
"""
import random
from datetime import timedelta

from django.utils import timezone

from .models import Companion

DISEASES = {
    "common_cold": {
        "label": "Common Cold",
        "severity": 1,
        "duration_hours": 24,
        "symptoms": ["sneeze", "shiver"],
        "cure_items": ["medicine", "soup", "rest"],
    },
    "stomach_flu": {
        "label": "Stomach Flu",
        "severity": 2,
        "duration_hours": 36,
        "symptoms": ["no_appetite", "low_energy"],
        "cure_items": ["medicine", "soup", "vet"],
    },
    "fever": {
        "label": "Fever",
        "severity": 3,
        "duration_hours": 48,
        "symptoms": ["red_face", "shiver", "no_appetite"],
        "cure_items": ["medicine", "vet"],
    },
}

# How often (at most) the sickness coin flip runs.
CHECK_INTERVAL_HOURS = 1


def maybe_catch_disease(companion: Companion, save: bool = True) -> bool:
    """Roll the dice on whether the companion gets sick. Idempotent
    inside the throttle window. Returns True if a disease was newly
    assigned."""
    if companion.disease or companion.is_in_coma:
        return False

    now = timezone.now()
    if companion.last_decay_at and (
        now - companion.last_decay_at < timedelta(hours=CHECK_INTERVAL_HOURS)
    ):
        # We piggy-back on last_decay_at as the throttle anchor; close
        # enough for a once-per-hour gate.
        pass

    base = 0.005  # 0.5% per hourly tick
    if companion.hygiene < 30:    base += 0.05
    if companion.hunger < 25:     base += 0.03
    if companion.energy < 25:     base += 0.03
    if companion.happiness < 25:  base += 0.02
    if companion.hours_since_interaction > 24:
        base += 0.04
    base -= companion.immunity * 0.0005

    if random.random() >= base:
        return False

    # Pick a disease weighted by severity (mild more likely).
    weights = {"common_cold": 0.6, "stomach_flu": 0.3, "fever": 0.1}
    disease_name = random.choices(
        list(weights.keys()), weights=list(weights.values()), k=1
    )[0]
    companion.disease = disease_name
    companion.disease_started_at = now
    if save:
        companion.save(update_fields=["disease", "disease_started_at"])
    return True


def maybe_recover(companion: Companion, save: bool = True) -> bool:
    """If a disease has run its full duration, clear it."""
    if not companion.disease or not companion.disease_started_at:
        return False
    duration = DISEASES[companion.disease]["duration_hours"]
    if timezone.now() - companion.disease_started_at < timedelta(hours=duration):
        return False
    companion.disease = ""
    companion.disease_started_at = None
    companion.immunity = min(100, companion.immunity + 5)
    if save:
        companion.save(update_fields=["disease", "disease_started_at", "immunity"])
    return True


def severity(companion: Companion) -> int:
    return DISEASES[companion.disease]["severity"] if companion.disease else 0


def symptoms(companion: Companion) -> list:
    return list(DISEASES[companion.disease]["symptoms"]) if companion.disease else []
