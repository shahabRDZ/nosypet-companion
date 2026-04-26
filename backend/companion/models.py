"""Domain models for the AI companion."""
from __future__ import annotations

from django.conf import settings
from django.db import models, transaction
from django.utils import timezone

from . import dna


class Companion(models.Model):
    STAT_MAX = 100

    # Identity: immutable, set at birth.
    owner = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="companion",
    )
    dna_seed = models.PositiveBigIntegerField(unique=True, editable=False)
    unique_code = models.CharField(max_length=12, unique=True, editable=False)
    species = models.CharField(max_length=24, default="companion-alpha", editable=False)
    parent_username_at_birth = models.CharField(max_length=150, editable=False)
    birth_at = models.DateTimeField(auto_now_add=True, editable=False)
    founder_number = models.PositiveIntegerField(null=True, blank=True, unique=True)

    name = models.CharField(max_length=30)

    # Vital stats. Decayed continuously based on real elapsed time.
    hunger = models.PositiveSmallIntegerField(default=80)
    happiness = models.PositiveSmallIntegerField(default=80)
    energy = models.PositiveSmallIntegerField(default=80)
    hygiene = models.PositiveSmallIntegerField(default=85)
    immunity = models.PositiveSmallIntegerField(default=70)

    # Sickness: a current disease, if any. We use a CharField + start
    # time rather than a separate table to keep queries simple. The
    # disease catalogue lives in `sickness.py`.
    disease = models.CharField(max_length=32, blank=True, default="")
    disease_started_at = models.DateTimeField(null=True, blank=True)

    # Lifecycle bookkeeping.
    last_decay_at = models.DateTimeField(default=timezone.now)
    last_interaction_at = models.DateTimeField(default=timezone.now)
    last_seen_at = models.DateTimeField(default=timezone.now)
    is_in_coma = models.BooleanField(default=False)
    coma_started_at = models.DateTimeField(null=True, blank=True)

    # Archetype lock (set at day 14).
    archetype_locked = models.CharField(max_length=24, blank=True, default="")
    archetype_locked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["founder_number"]),
            models.Index(fields=["birth_at"]),
        ]

    @classmethod
    @transaction.atomic
    def hatch(cls, *, owner, name: str) -> "Companion":
        """Create a companion with a fresh seed and atomically claim a
        founder slot if any are left."""
        for _ in range(5):
            seed = dna.new_seed()
            if not cls.objects.filter(dna_seed=seed).exists():
                break
        else:
            raise RuntimeError("Could not allocate a unique DNA seed.")

        founder_no = cls._claim_founder_slot()

        return cls.objects.create(
            owner=owner,
            name=name,
            dna_seed=seed,
            unique_code=dna.unique_code(seed),
            parent_username_at_birth=owner.username,
            founder_number=founder_no,
        )

    @classmethod
    def _claim_founder_slot(cls) -> int | None:
        from django.conf import settings as s
        limit = getattr(s, "FOUNDER_LIMIT", 100)
        existing = cls.objects.select_for_update().filter(founder_number__isnull=False).count()
        if existing >= limit:
            return None
        return existing + 1

    @property
    def phenotype(self):
        return dna.derive(self.dna_seed)

    @property
    def age_days(self) -> int:
        return max(0, (timezone.now() - self.birth_at).days)

    @property
    def archetype(self):
        """Locked archetype if old enough, else a preview of what it
        *would* be if locked today. Frontend uses this to show a soft
        hint of the developing personality before day 14."""
        if self.archetype_locked:
            return self.archetype_locked
        return self._compute_archetype()

    def _compute_archetype(self) -> str:
        traits = {t.trait: t.value for t in self.traits.all()}
        for name, predicate in ARCHETYPE_RULES:
            if predicate(traits):
                return name
        return "strange_one"

    @property
    def is_sick(self) -> bool:
        return bool(self.disease)

    @property
    def overall_score(self) -> int:
        return (self.hunger + self.happiness + self.energy + self.hygiene) // 4

    @property
    def hours_since_interaction(self) -> float:
        return (timezone.now() - self.last_interaction_at).total_seconds() / 3600

    def touch_interaction(self):
        """Mark that the owner just did something. Resets neglect timers."""
        self.last_interaction_at = timezone.now()
        self.last_seen_at = timezone.now()

    def __str__(self):
        return f"{self.name} ({self.unique_code})"


TRAIT_KEYS = ("affection", "discipline", "curiosity", "confidence", "playfulness")

ARCHETYPE_RULES = [
    ("loyal_lover",      lambda t: t.get("affection", 0) > 70 and t.get("discipline", 0) > 50),
    ("wild_explorer",    lambda t: t.get("curiosity", 0) > 70 and t.get("playfulness", 0) > 70),
    ("quiet_scholar",    lambda t: t.get("curiosity", 0) > 80 and t.get("discipline", 0) > 60),
    ("emotional_artist", lambda t: t.get("affection", 0) > 60 and t.get("confidence", 0) < 40),
    ("proud_leader",     lambda t: t.get("confidence", 0) > 80 and t.get("discipline", 0) > 60),
    ("lonely_soul",      lambda t: all(t.get(k, 0) < 30 for k in TRAIT_KEYS)),
]


class CompanionTrait(models.Model):
    companion = models.ForeignKey(Companion, on_delete=models.CASCADE, related_name="traits")
    trait = models.CharField(max_length=20, choices=[(k, k) for k in TRAIT_KEYS])
    value = models.IntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("companion", "trait")]


class CompanionMemory(models.Model):
    """Structured facts only. No raw transcripts ever."""

    FACT_OWNER_NAME = "owner_name"
    FACT_PREFERENCE = "preference"
    FACT_SCHEDULE = "schedule"
    FACT_EVENT = "event"
    FACT_NICKNAME = "nickname"
    FACT_CHOICES = [
        (FACT_OWNER_NAME, "Owner name"),
        (FACT_PREFERENCE, "Preference"),
        (FACT_SCHEDULE, "Schedule"),
        (FACT_EVENT, "Event"),
        (FACT_NICKNAME, "Nickname"),
    ]

    companion = models.ForeignKey(Companion, on_delete=models.CASCADE, related_name="memories")
    fact_type = models.CharField(max_length=20, choices=FACT_CHOICES)
    key = models.CharField(max_length=80)
    value = models.TextField()
    confidence = models.FloatField(default=0.5)
    learned_at = models.DateTimeField(auto_now_add=True)
    last_referenced_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-learned_at"]
        indexes = [models.Index(fields=["companion", "fact_type"])]
        unique_together = [("companion", "fact_type", "key")]


class BehaviorEvent(models.Model):
    companion = models.ForeignKey(Companion, on_delete=models.CASCADE, related_name="events")
    event_type = models.CharField(max_length=40)
    detail = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["companion", "-created_at"])]
