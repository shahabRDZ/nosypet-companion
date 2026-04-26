"""DNA system: deterministic phenotype derivation from a 64-bit seed.

The seed is the *only* thing stored in the database. All visible traits
and the unique fingerprint art are recomputed from it on demand. This
guarantees:
  * reproducibility (same seed -> same companion forever)
  * cheap storage (one integer instead of dozens of fields)
  * provability (a third party can verify a claimed companion's look
    by re-running this function with the public seed)
"""
from __future__ import annotations

import random
import secrets
from dataclasses import asdict, dataclass

# Phenotype option pools. Adding a new option to any list is a *breaking
# change* because it shifts the deterministic distribution. Append-only.
BODY_COLORS = [
    ("lavender", "#c8b2ff"),
    ("peach",    "#ffc7a8"),
    ("mint",     "#aef2cf"),
    ("sky",      "#a8d8ff"),
    ("cream",    "#fff0c4"),
    ("rose",     "#ffb3d6"),
    ("sage",     "#c8e6b8"),
    ("lilac",    "#dabaff"),
]
EYE_COLORS = [
    ("amber",    "#ffb627"),
    ("sapphire", "#3b82f6"),
    ("rose",     "#f472b6"),
    ("emerald",  "#10b981"),
    ("violet",   "#8b5cf6"),
    ("topaz",    "#fbbf24"),
]
PATTERNS    = ["solid", "spots", "stripes", "patches", "freckles"]
EAR_SHAPES  = ["round", "pointy", "floppy", "tufted", "small"]
TAIL_STYLES = ["long", "short", "fluffy", "curly", "stubby"]
TEMPERAMENTS = ["calm", "wild", "shy", "bold", "curious", "lazy", "energetic"]
TALENTS     = ["musical", "athletic", "smart", "social", "artistic", "gentle"]


@dataclass(frozen=True)
class Phenotype:
    body_color_name: str
    body_color_hex: str
    eye_color_name: str
    eye_color_hex: str
    pattern: str
    ear_shape: str
    tail_style: str
    size_modifier: float            # 0.85 .. 1.15
    temperament_seed: str
    talent: str
    fingerprint: list[float]        # 64 floats in [0, 1) for SVG fingerprint art
    accent_color_hex: str           # secondary hue, harmonized with body
    pattern_density: float          # 0.2 .. 0.8

    def to_dict(self) -> dict:
        return asdict(self)


def new_seed() -> int:
    """Generate a fresh 63-bit seed (fits in PositiveBigIntegerField)."""
    return secrets.randbits(63)


def derive(seed: int) -> Phenotype:
    """Pure: same seed always returns the same Phenotype."""
    rng = random.Random(seed)

    body_name, body_hex = rng.choice(BODY_COLORS)
    eye_name,  eye_hex  = rng.choice(EYE_COLORS)

    return Phenotype(
        body_color_name=body_name,
        body_color_hex=body_hex,
        eye_color_name=eye_name,
        eye_color_hex=eye_hex,
        pattern=rng.choice(PATTERNS),
        ear_shape=rng.choice(EAR_SHAPES),
        tail_style=rng.choice(TAIL_STYLES),
        size_modifier=round(rng.uniform(0.85, 1.15), 3),
        temperament_seed=rng.choice(TEMPERAMENTS),
        talent=rng.choice(TALENTS),
        fingerprint=[round(rng.random(), 4) for _ in range(64)],
        accent_color_hex=_harmonize(body_hex, rng),
        pattern_density=round(rng.uniform(0.2, 0.8), 3),
    )


def _harmonize(base_hex: str, rng: random.Random) -> str:
    """Pick an accent that pairs with the body color using a simple hue
    rotation. Not full color theory, but reliably pleasant."""
    r = int(base_hex[1:3], 16)
    g = int(base_hex[3:5], 16)
    b = int(base_hex[5:7], 16)
    # Shift each channel by +-40, clamped.
    delta = rng.choice([-50, -30, 30, 50])
    r2 = max(0, min(255, r + delta))
    g2 = max(0, min(255, g - delta // 2))
    b2 = max(0, min(255, b + delta // 3))
    return f"#{r2:02x}{g2:02x}{b2:02x}"


def unique_code(seed: int) -> str:
    """Human-readable identifier derived from the seed.

    Format: NP-XXXX-YYYY. Uses base32 without ambiguous chars (no 0/O/1/I).
    Collision risk is negligible for our scale (~10^11 possibilities).
    """
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # 32 chars
    n = seed
    parts = []
    for _ in range(8):
        parts.append(alphabet[n % 32])
        n //= 32
    code = "".join(parts)
    return f"NP-{code[:4]}-{code[4:]}"
