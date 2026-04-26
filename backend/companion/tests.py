"""Tests for the companion app."""
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse

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
