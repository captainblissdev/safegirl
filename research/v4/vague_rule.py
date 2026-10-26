"""Python port of the gateway's vague-query rule, for the V4 CV runs.

The rule is app/gateway/src/vagueQuery.js (isVagueQuery) with
normalize() from app/gateway/src/helpSignposting.js: a query is vague
when it has at most MAX_CONTENT_WORDS content words (words not in the
function-word list) and none of them, and no phrase in it, is a health
term. Nothing is copied by hand: the function words are read from
vagueQuery.js itself and the health terms from the two JSON files the
gateway reads, so the port cannot drift from the rule.
tests/test_vague_rule.py checks parity with the JavaScript rule on every
seed and paraphrase.
"""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
GATEWAY = REPO / "app" / "gateway" / "src"
MAX_CONTENT_WORDS = 3
APOSTROPHES = "['‘’ʼ]"


@lru_cache(maxsize=None)
def function_words() -> frozenset[str]:
    source = (GATEWAY / "vagueQuery.js").read_text(encoding="utf-8")
    body = re.search(r"const FUNCTION_WORDS = new Set\(\[(.*?)\]\);", source, re.S).group(1)
    words = frozenset(re.findall(r'"([^"]+)"', body))
    assert len(words) > 100, "FUNCTION_WORDS not found in vagueQuery.js"
    return words


@lru_cache(maxsize=None)
def health_terms() -> tuple[frozenset[str], tuple[str, ...]]:
    """(single words from both term files, phrases from the extra file)."""
    kb = json.loads((GATEWAY / "content" / "healthTerms.json").read_text(encoding="utf-8"))["terms"]
    extra = [t for c in json.loads((GATEWAY / "content" / "extraHealthTerms.json").read_text(encoding="utf-8"))["categories"]
             for t in c["terms"]]
    words = frozenset(kb) | frozenset(t for t in extra if " " not in t)
    return words, tuple(t for t in extra if " " in t)


def _lower(text: str) -> str:
    # JavaScript's toLowerCase(); only ASCII letters survive the next step
    # in both languages, so the rare differences in Unicode case mapping
    # cannot change the result.
    return text.lower()


def normalize(text: str) -> str:
    """helpSignposting.js normalize()."""
    t = _lower(text)
    t = re.sub(APOSTROPHES, "", t)
    t = re.sub(r"[^a-z0-9 ]+", " ", t)
    t = re.sub(r"\bplease\b", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return re.sub(r"^(hi|hello|hey)( there)? ", "", t)


def tokenize(text: str) -> list[str]:
    """vagueQuery.js tokenize()."""
    t = re.sub(APOSTROPHES, "", _lower(text))
    t = re.sub(r"[^a-z0-9]+", " ", t).strip()
    return [w for w in t.split(" ") if w]


def content_words(text: str) -> list[str]:
    fw = function_words()
    return [w for w in tokenize(normalize(text)) if w not in fw]


def is_health_term(word: str) -> bool:
    terms = health_terms()[0]
    return (word in terms or f"{word}s" in terms
            or (word.endswith("s") and word[:-1] in terms)
            or (word.endswith("es") and word[:-2] in terms))


def has_health_phrase(text: str) -> bool:
    padded = f" {' '.join(tokenize(normalize(text)))} "
    return any(f" {p} " in padded for p in health_terms()[1])


def is_vague(text) -> bool:
    """vagueQuery.js isVagueQuery()."""
    if not isinstance(text, str):
        return False
    words = content_words(text)
    return (len(words) <= MAX_CONTENT_WORDS and not any(is_health_term(w) for w in words)
            and not has_health_phrase(text))
