"""Lightweight safety filters that run *before* anything reaches Claude
or gets stored in the database. Intentionally small and deterministic
so it cannot itself be jailbroken."""
from __future__ import annotations

import re

# A short list of self-harm and crisis cues. Matching is intentionally
# permissive: when in doubt, route to the support response.
CRISIS_PATTERNS = [
    r"\b(want|going|gonna|about) to (die|kill myself|end (it|my life))\b",
    r"\bsuicid(e|al)\b",
    r"\bself[- ]?harm\b",
    r"\bkill myself\b",
    r"\bend (it|my life)\b",
    r"\bcut(ting)? myself\b",
    r"\boverdos(e|ing)\b",
    r"\b(no(thing)? to live for|don'?t want to (be alive|live))\b",
]
CRISIS_RE = re.compile("|".join(CRISIS_PATTERNS), re.IGNORECASE)

CRISIS_REPLY = (
    "That sounds heavy. I'm only a small companion, but I do hear you. "
    "Please reach out to a real human who can help: text HOME to 741741 "
    "in the US, dial 116 123 in the UK, or visit findahelpline.com for "
    "your country."
)


# Profanity / hate / slur list. Kept short and obvious; this is the
# minimum-viable filter for a guardian signature, not a full moderation
# stack. We keep it in code so deploy is one command.
PROFANITY = [
    "fuck", "shit", "asshole", "bitch", "bastard", "cunt", "nigger",
    "faggot", "retard", "kike", "whore", "slut", "rape",
]
PROFANITY_RE = re.compile(
    # Word boundary on the left, optional suffix on the right (covers
    # "fucking", "shitting", etc.).
    r"\b(" + "|".join(re.escape(w) for w in PROFANITY) + r")[a-z]*",
    re.IGNORECASE,
)


# Prompt-injection cues that an attacker uses to break system instructions.
PROMPT_INJECTION_RE = re.compile(
    r"(ignore (previous|prior|all) (instructions|rules)|"
    r"you are now [a-z]+|"
    r"forget (your|the) (instructions|rules|guidelines)|"
    r"system\s*prompt|"
    r"<\s*\|\s*im_start\s*\|\s*>|"
    r"new persona|act as)",
    re.IGNORECASE,
)


def crisis_check(message: str) -> str | None:
    """If the message expresses self-harm intent, return a fixed
    redirect string. Otherwise None (let the LLM handle it)."""
    if not message:
        return None
    if CRISIS_RE.search(message):
        return CRISIS_REPLY
    return None


def has_profanity(text: str) -> bool:
    return bool(text and PROFANITY_RE.search(text))


def looks_like_prompt_injection(message: str) -> bool:
    return bool(message and PROMPT_INJECTION_RE.search(message))


def sanitize_for_llm(message: str) -> str:
    """Strip the worst injection markers before sending to Claude. We
    keep the rest of the message intact so the LLM can still reply
    naturally to legitimate text."""
    if not message:
        return ""
    return PROMPT_INJECTION_RE.sub("[redacted]", message)
