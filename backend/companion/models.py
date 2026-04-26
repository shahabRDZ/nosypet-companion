"""Domain models for the AI companion."""
from __future__ import annotations

from django.conf import settings
from django.db import models, transaction
from django.utils import timezone

from . import dna


class Companion(models.Model):
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

    last_seen_at = models.DateTimeField(default=timezone.now)
    is_in_coma = models.BooleanField(default=False)

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
        if self.age_days < 14:
            return None
        return self._compute_archetype()

    def _compute_archetype(self):
        traits = {t.trait: t.value for t in self.traits.all()}
        for name, predicate in ARCHETYPE_RULES:
            if predicate(traits):
                return name
        return "strange_one"

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
