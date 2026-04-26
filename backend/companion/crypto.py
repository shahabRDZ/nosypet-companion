"""Symmetric encryption for memory values stored at rest.

Uses Fernet (AES-128-CBC + HMAC-SHA-256). The key is derived from
``DJANGO_SECRET_KEY`` so no extra secret needs to be managed, and is
re-derivable on every boot. If ``MEMORY_ENCRYPTION_DISABLED`` is set
(useful for testing or for users opting out) we fall back to plain
storage with a stable prefix so we can still tell ciphertext from
plaintext when reading old rows.
"""
from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings

PLAINTEXT_PREFIX = "p:"
CIPHERTEXT_PREFIX = "e:"


def _key() -> bytes:
    secret = settings.SECRET_KEY.encode("utf-8")
    digest = hashlib.sha256(secret).digest()
    return base64.urlsafe_b64encode(digest)


def _fernet() -> Fernet:
    return Fernet(_key())


def encrypt(value: str) -> str:
    if value is None:
        return ""
    if getattr(settings, "MEMORY_ENCRYPTION_DISABLED", False):
        return f"{PLAINTEXT_PREFIX}{value}"
    token = _fernet().encrypt(value.encode("utf-8")).decode("ascii")
    return f"{CIPHERTEXT_PREFIX}{token}"


def decrypt(stored: str) -> str:
    if not stored:
        return ""
    if stored.startswith(PLAINTEXT_PREFIX):
        return stored[len(PLAINTEXT_PREFIX):]
    if stored.startswith(CIPHERTEXT_PREFIX):
        try:
            return _fernet().decrypt(stored[len(CIPHERTEXT_PREFIX):].encode("ascii")).decode("utf-8")
        except InvalidToken:
            return "[corrupted]"
    # Legacy rows that pre-date this module are stored as-is.
    return stored
