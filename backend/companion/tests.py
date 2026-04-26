"""Tests for the companion app."""
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from companion import dna
from companion.models import Companion

User = get_user_model()


class DnaDeterminismTests(TestCase):
    def test_same_seed_yields_same_phenotype(self):
        a = dna.derive(123456789)
        b = dna.derive(123456789)
        self.assertEqual(a.to_dict(), b.to_dict())

    def test_different_seeds_diverge(self):
        a = dna.derive(1)
        b = dna.derive(2)
        self.assertNotEqual(a.to_dict(), b.to_dict())

    def test_unique_code_format(self):
        code = dna.unique_code(99)
        self.assertTrue(code.startswith("NP-"))
        self.assertEqual(len(code), 12)  # NP-XXXX-YYYY

    def test_fingerprint_is_64_floats(self):
        p = dna.derive(42)
        self.assertEqual(len(p.fingerprint), 64)
        self.assertTrue(all(0 <= f < 1 for f in p.fingerprint))


class HatchTests(TestCase):
    def test_hatch_creates_one_companion(self):
        u = User.objects.create_user(username="alice", password="pw")
        c = Companion.hatch(owner=u, name="Pixel")
        self.assertEqual(c.name, "Pixel")
        self.assertTrue(c.unique_code.startswith("NP-"))
        self.assertGreater(c.dna_seed, 0)
        self.assertEqual(c.parent_username_at_birth, "alice")

    def test_first_user_is_founder_one(self):
        u = User.objects.create_user(username="first", password="pw")
        c = Companion.hatch(owner=u, name="One")
        self.assertEqual(c.founder_number, 1)

    @override_settings(FOUNDER_LIMIT=3)
    def test_founder_limit_is_enforced(self):
        for i in range(5):
            u = User.objects.create_user(username=f"u{i}", password="pw")
            Companion.hatch(owner=u, name=f"P{i}")
        nums = Companion.objects.values_list("founder_number", flat=True)
        founders = sorted(n for n in nums if n is not None)
        non_founders = [n for n in nums if n is None]
        self.assertEqual(founders, [1, 2, 3])
        self.assertEqual(len(non_founders), 2)


@override_settings(RATELIMIT_ENABLE=False)
class ApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="bob", password="strongpass1!")

    def test_signup_creates_user_and_session(self):
        res = self.client.post(
            reverse("companion:signup"),
            data={"username": "newby", "password": "longenough1", "email": "n@e.com"},
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["authenticated"])
        self.assertFalse(res.json()["has_companion"])

    def test_hatch_then_get_certificate(self):
        self.client.login(username="bob", password="strongpass1!")
        res = self.client.post(
            reverse("companion:hatch"),
            data={"name": "Echo"},
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 201)
        body = res.json()
        self.assertEqual(body["name"], "Echo")
        self.assertIn("phenotype", body)

        cert_res = self.client.get(reverse("companion:certificate"))
        self.assertEqual(cert_res.status_code, 200)
        self.assertEqual(cert_res.json()["unique_code"], body["unique_code"])

    def test_cannot_hatch_twice(self):
        Companion.hatch(owner=self.user, name="One")
        self.client.login(username="bob", password="strongpass1!")
        res = self.client.post(
            reverse("companion:hatch"),
            data={"name": "Two"},
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 409)

    def test_public_verify_endpoint(self):
        c = Companion.hatch(owner=self.user, name="V")
        res = self.client.get(reverse("companion:verify", args=[c.unique_code]))
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["verified"])


@override_settings(RATELIMIT_ENABLE=False)
class ServiceActionTests(TestCase):
    def setUp(self):
        from companion.models import Companion
        self.user = User.objects.create_user(username="actor", password="strongpass1!")
        self.companion = Companion.hatch(owner=self.user, name="Echo")

    def test_feed_grants_traits_and_event(self):
        from companion import services
        from companion.models import BehaviorEvent, CompanionTrait
        self.companion.hunger = 40
        self.companion.save()
        c = services.feed(self.user)
        self.assertEqual(c.hunger, 65)
        self.assertEqual(BehaviorEvent.objects.filter(companion=c, event_type="feed").count(), 1)
        self.assertTrue(CompanionTrait.objects.filter(companion=c, trait="affection").exists())

    def test_play_costs_energy(self):
        from companion import services
        c = services.play(self.user)
        self.assertEqual(c.happiness, 100)
        self.assertEqual(c.energy, 65)

    def test_in_coma_blocks_actions(self):
        from companion import services
        from companion.models import Companion
        Companion.objects.filter(pk=self.companion.pk).update(is_in_coma=True)
        with self.assertRaises(services.InComa):
            services.feed(self.user)

    def test_revive_clears_coma_and_restores_stats(self):
        from companion import services
        from companion.models import Companion, CompanionMemory
        Companion.objects.filter(pk=self.companion.pk).update(
            is_in_coma=True, hunger=0, energy=0, happiness=0, hygiene=0,
        )
        # Seed some memories to test the 20% drop.
        for i in range(10):
            CompanionMemory.objects.create(
                companion=self.companion, fact_type="event",
                key=f"k{i}", value=f"v{i}", confidence=i / 10,
            )
        c = services.revive_from_coma(self.user)
        self.assertFalse(c.is_in_coma)
        self.assertGreaterEqual(c.hunger, 50)
        self.assertEqual(CompanionMemory.objects.filter(companion=c).count(), 8)


@override_settings(RATELIMIT_ENABLE=False)
class ChatEndpointTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="chatty", password="strongpass1!")
        Companion.hatch(owner=self.user, name="Tilly")
        self.client.login(username="chatty", password="strongpass1!")

    def test_chat_returns_reply(self):
        # No API key in tests -> falls back to canned line.
        res = self.client.post(
            reverse("companion:chat"),
            data={"message": "Hi there"},
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertIn("reply", body)
        self.assertTrue(len(body["reply"]) > 0)
        self.assertFalse(body["in_coma"])


class DecayTests(TestCase):
    def test_decay_drops_stats_after_long_interval(self):
        from datetime import timedelta

        from companion import decay
        from companion.models import Companion

        u = User.objects.create_user(username="decay", password="pw")
        c = Companion.hatch(owner=u, name="D")
        c.last_decay_at = timezone.now() - timedelta(minutes=10)
        c.save()
        decay.apply(c)
        self.assertLessEqual(c.hunger, 80 - 10)


class ArchetypeLockTests(TestCase):
    def test_archetype_locks_at_day_14(self):
        from datetime import timedelta

        from companion import services
        from companion.models import Companion, CompanionTrait

        u = User.objects.create_user(username="ageing", password="pw")
        c = Companion.hatch(owner=u, name="A")
        # Force the companion to be 15 days old.
        Companion.objects.filter(pk=c.pk).update(birth_at=timezone.now() - timedelta(days=15))
        c.refresh_from_db()
        # Give it traits that should pick a specific archetype.
        CompanionTrait.objects.create(companion=c, trait="curiosity", value=85)
        CompanionTrait.objects.create(companion=c, trait="discipline", value=70)
        # Refresh runs the lock check.
        services.refresh(c)
        c.refresh_from_db()
        self.assertEqual(c.archetype_locked, "quiet_scholar")
