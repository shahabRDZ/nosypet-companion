"""Serialization helpers. Plain dicts, no DRF dependency."""
from __future__ import annotations

from . import dna
from .models import Companion


def serialize_companion(c: Companion) -> dict:
    pheno = c.phenotype
    return {
        "id": c.id,
        "name": c.name,
        "unique_code": c.unique_code,
        "species": c.species,
        "birth_at": c.birth_at.isoformat(),
        "age_days": c.age_days,
        "founder_number": c.founder_number,
        "is_founder": c.founder_number is not None,
        "parent_username_at_birth": c.parent_username_at_birth,
        "dna_seed": c.dna_seed,
        "phenotype": pheno.to_dict(),
        "archetype": c.archetype,
        "is_in_coma": c.is_in_coma,
    }


def serialize_certificate(c: Companion) -> dict:
    """A lean payload tuned for the AI Passport page."""
    pheno = c.phenotype
    return {
        "name": c.name,
        "unique_code": c.unique_code,
        "designation": dna.designation(c.dna_seed),
        "species": c.species,
        "birth_at": c.birth_at.isoformat(),
        "parent_username": c.parent_username_at_birth,
        "founder_number": c.founder_number,
        "is_founder": c.founder_number is not None,
        "phenotype": pheno.to_dict(),
        "verification_hint": dna.unique_code(c.dna_seed),
        "pledge_signature": c.pledge_signature,
        "pledge_signed_at": c.pledge_signed_at.isoformat() if c.pledge_signed_at else None,
    }
