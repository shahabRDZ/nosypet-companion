"""Sickness model. Reads its catalogue from the Disease table when
populated; otherwise falls back to a small built-in catalogue."""
import random
from datetime import timedelta

from django.utils import timezone

from .models import Companion, Disease

_FALLBACK = {
    "common_cold": {
        "label": "Common Cold",
        "severity": 1,
        "duration_hours": 24,
        "symptoms": ["sneeze", "shiver"],
        "cure_items": ["medicine", "soup", "rest"],
        "weight": 0.6,
    },
    "stomach_flu": {
        "label": "Stomach Flu",
        "severity": 2,
        "duration_hours": 36,
        "symptoms": ["no_appetite", "low_energy"],
        "cure_items": ["medicine", "soup", "vet"],
        "weight": 0.3,
    },
    "fever": {
        "label": "Fever",
        "severity": 3,
        "duration_hours": 48,
        "symptoms": ["red_face", "shiver", "no_appetite"],
        "cure_items": ["medicine", "vet"],
        "weight": 0.1,
    },
}


def _catalogue() -> dict[str, dict]:
    rows = list(Disease.objects.all())
    if not rows:
        return _FALLBACK
    return {
        d.slug: {
            "label": d.label,
            "severity": d.severity,
            "duration_hours": d.duration_hours,
            "symptoms": list(d.symptoms or []),
            "cure_items": list(d.cure_items or []),
            "weight": float(d.weight or 1.0),
        } for d in rows
    }


def maybe_catch_disease(companion: Companion, save: bool = True) -> bool:
    if companion.disease or companion.is_in_coma:
        return False
    base = 0.005
    if companion.hygiene < 30:    base += 0.05
    if companion.hunger < 25:     base += 0.03
    if companion.energy < 25:     base += 0.03
    if companion.happiness < 25:  base += 0.02
    if companion.hours_since_interaction > 24:
        base += 0.04
    base -= companion.immunity * 0.0005

    if random.random() >= base:
        return False

    catalogue = _catalogue()
    slugs = list(catalogue.keys())
    weights = [catalogue[s]["weight"] for s in slugs]
    chosen = random.choices(slugs, weights=weights, k=1)[0]
    companion.disease = chosen
    companion.disease_started_at = timezone.now()
    if save:
        companion.save(update_fields=["disease", "disease_started_at"])
    return True


def maybe_recover(companion: Companion, save: bool = True) -> bool:
    if not companion.disease or not companion.disease_started_at:
        return False
    catalogue = _catalogue()
    info = catalogue.get(companion.disease)
    if info is None:
        # Disease slug no longer in catalogue; clear it.
        companion.disease = ""
        companion.disease_started_at = None
        if save:
            companion.save(update_fields=["disease", "disease_started_at"])
        return True
    if timezone.now() - companion.disease_started_at < timedelta(hours=info["duration_hours"]):
        return False
    companion.disease = ""
    companion.disease_started_at = None
    companion.immunity = min(100, companion.immunity + 5)
    if save:
        companion.save(update_fields=["disease", "disease_started_at", "immunity"])
    return True


def severity(companion: Companion) -> int:
    info = _catalogue().get(companion.disease)
    return info["severity"] if info else 0


def symptoms(companion: Companion) -> list:
    info = _catalogue().get(companion.disease)
    return list(info["symptoms"]) if info else []
