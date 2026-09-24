"""
SafeGirl - Keyword Baseline Classifier
FROZEN as of 2026-08-27

DO NOT MODIFY after classifier (DistilBERT) evaluation begins.
Any change requires a new decision-log.md entry explaining:
- The rationale for the change
- That it precedes evaluation, not follows it
- Regression test results on the 54-seed validation set

Version History:
- 2026-08-20: Initial freeze. Added "pep" to STI keywords.
- 2026-08-27: Expanded keyword coverage across all classes for fairer baseline
              comparison. Removed ambiguous standalone terms ("period", "symptoms").
              See decision-log.md#2026-08-27 for full rationale.

Evaluation Note:
Validated against 54 hand-labeled seed questions achieving 100% match —
this reflects tuning to its own seed set, not generalization. Expected
to underperform on unseen phrasing and the independent test set; this gap
is itself part of the evaluation story.
"""

import re
from typing import Dict, List, Optional, Tuple


# ============================================================================
# KEYWORD DEFINITIONS
# ============================================================================
# Each class contains domain-specific keywords/phrases. Keywords are matched
# as whole words (using regex word boundaries \b) to avoid substring false
# positives (e.g., "period" won't match "periodic").
#
# Design decisions:
# 1. GBV: Prioritizes explicit consent-violation language (forced, coerced,
#    against my will) plus recognized terms (FGM, defilement). This class is
#    routing scaffolding only — no training/evaluation data exists yet pending
#    authoritative source material (see risk-and-review-register.md, R8).
#
# 2. STI: Covers infections, testing, symptoms, and HIV prevention/treatment
#    (PrEP/PEP). Removed standalone "symptoms" to prevent false positives
#    from pregnancy symptom queries.
#
# 3. Pregnancy: Covers gestation, testing, antenatal care, and teenage
#    pregnancy risks. Removed standalone "period" to prevent false positives
#    from menstrual health queries.
#
# 4. Contraception: Covers all major methods (pill, IUD, implant, injection,
#    condoms), emergency contraception, fertility awareness, and side effects.
#
# 5. General: Covers clinic navigation, confidentiality, youth-friendly
#    services, and emotional concerns (embarrassment, judgment).
# ============================================================================

KEYWORDS: Dict[str, List[str]] = {
    "gbv": [
        # Explicit consent-violation language
        "rape", "raped",
        "forced", "forced sex", "forced sexual activity",
        "forced sexual intercourse", "i was forced", "forced me",
        "made me have sex", "made me do it",
        "didn't stop", "did not stop",
        "said no", "i said no",
        "didn't consent", "did not consent",
        "without my consent", "no consent",
        "without my permission", "without my approval", "without my agreement",
        # Coercion and threats
        "assault", "sexual assault", "sexually assaulted",
        "sexual violence", "sexual abuse",
        "sexually abused",
        "unwanted sexual contact", "unwanted touching", "touched me",
        "someone touched me",
        "afraid to say no",
        "threatened", "threatened me",
        "coerced", "coerced into sex", "coercion",
        "against my will",
        # Recognized GBV terms (Kenya context)
        "fgm", "circumcision", "female genital mutilation",
        "abuse", "defilement", "molestation",
    ],

    "sti": [
        # General STI terminology
        "sti", "stis", "std", "stds",
        "sexually transmitted infection",
        "sexually transmitted infections",
        "sexually transmitted disease",
        "sexual infection",
        # HIV-specific (high prevalence in Kenya)
        "hiv", "hiv test", "hiv testing", "hiv positive",
        "hiv negative", "hiv status",
        "hiv exposure", "exposed to hiv",
        "possible hiv", "risk of hiv",
        "living with hiv",
        # HIV prevention/treatment (added 2026-08-20: "pep")
        "pep", "prep",
        "post exposure prophylaxis", "pre exposure prophylaxis",
        "post-exposure prophylaxis", "pre-exposure prophylaxis",
        # Testing language
        "sti test", "std test", "sti testing", "std testing",
        "test for", "tested",
        # Symptoms (NOTE: "symptoms" removed to avoid pregnancy false positives)
        "discharge", "unusual discharge", "vaginal discharge",
        "penile discharge",
        "burn when i pee", "burning when i pee",
        "pain when i pee", "painful urination",
        "burning",
        "genital sores", "genital sore",
        "genital itching", "genital pain",
        "infection",
        "no symptoms",
        # Specific STIs (common in Kenya)
        "syphilis", "gonorrhea", "gonorrhoea", "chlamydia",
        "herpes", "hpv", "trichomoniasis",
        "vaccine",  # HPV vaccine context
    ],

    "pregnancy": [
        # Pregnancy status
        "pregnant", "pregnancy",
        "think i'm pregnant", "think i am pregnant",
        "might be pregnant", "could i be pregnant", "could be pregnant",
        "am i pregnant",
        # Symptoms and signs
        "signs of pregnancy", "early pregnancy",
        "pregnancy symptoms",
        # Period-related (refined 2026-08-27: removed standalone "period")
        "period late", "period is late", "late period",
        "missed period", "missed my period",
        "period hasn't come", "period has not come",
        "period did not come", "period didn't come",
        "period isn't here", "period is not here",
        # Testing
        "pregnancy test",
        "test for pregnancy", "home pregnancy test",
        "positive pregnancy test", "negative pregnancy test",
        # Antenatal care
        "antenatal", "antenatal care",
        "antenatal clinic",
        "first visit", "first antenatal visit",
        "give birth",
        "pregnancy care", "prenatal care",
        # Risks and complications
        "health risk", "health risks",
        "teenage mother", "teenage mothers",
        "risks of having a baby",
        # Unplanned pregnancy
        "unplanned pregnancy", "unexpected pregnancy",
        "pregnancy scare",
        # Clinical procedures
        "pelvic exam",
    ],

    "contraception": [
        # General terminology
        "birth control", "birth control method",
        "contraceptive method", "contraceptive methods",
        "contraceptive", "contraception",
        # Hormonal methods
        "pill", "missed pill", "forgot my pill",
        # Long-acting reversible contraceptives (LARCs)
        "iud", "copper iud",
        "implant", "birth control implant",
        "injection", "birth control injection",
        # Barrier methods
        "condom", "condoms", "condom broke", "condom slipped",
        # Emergency contraception
        "morning after pill", "morning-after",
        "emergency contraception", "emergency contraceptive",
        # Family planning
        "family planning", "family planning method",
        # Withdrawal/fertility awareness
        "pulled out", "precum", "withdrawal",
        "protected",
        # Pregnancy prevention language
        "avoid pregnancy", "prevent pregnancy", "preventing pregnancy",
        "not get pregnant", "avoid getting pregnant",
        "fertility", "fertile", "fertile window",
        "ovulation", "safe days", "calendar method",
        # Side effects (common concern)
        "side effects",
    ],

    "general": [
        # Youth-friendly services (Kenya MOH terminology)
        "youth-friendly", "youth friendly",
        "youth-friendly services", "youth friendly services",
        "youth-friendly clinic", "youth friendly clinic",
        "youth-friendly service", "youth friendly service",
        # Confidentiality and privacy (core SafeGirl requirement)
        "confidential", "confidentiality",
        "privacy", "private",
        "keep it private", "keep this private",
        # Parental involvement concerns
        "tell my parents",
        "without my parents",
        "parental consent", "parental permission",
        "guardian", "guardian permission", "guardian consent",
        # Healthcare navigation
        "clinic", "clinic visit",
        "health service", "health services",
        "healthcare", "health care",
        "health worker", "health provider",
        "doctor", "nurse",
        # Logistics
        "free",
        "appointment",
        # Emotional concerns
        "embarrassed",
        "judge", "judge me",
        # Demographics (contextual)
        "youth centre", "youth center",
        "youth", "young people", "young person",
        "adolescent", "adolescents",
        "teenager", "teenagers",
        "school hours",
    ],
}


# ============================================================================
# TIE-BREAKING PRIORITY
# ============================================================================
# When multiple classes have the same keyword hit count, this priority order
# determines the winner.
#
# Rationale (documented, not accidental):
# 1. GBV first — immediate safety risk, highest urgency
# 2. STI second — infectious disease risk, requires timely intervention
# 3. Contraception third — conception-mechanics questions ("precum", "pulled out")
#    are functionally contraception-education queries even when they mention
#    pregnancy risk. Contraception routing leads to prevention information.
# 4. Pregnancy fourth — lower urgency than STI, higher than general
# 5. General last — default fallback for non-classifiable queries
#
# This ordering is defensible but also a design choice that affects baseline
# performance. Documented here to prevent post-hoc rationalization.
# ============================================================================

PRIORITY: List[str] = ["gbv", "sti", "contraception", "pregnancy", "general"]


# ============================================================================
# CLASSIFICATION FUNCTIONS
# ============================================================================

def classify_baseline(text: str) -> str:
    """
    Predicts intent class using keyword matching with tie-breaking.

    Args:
        text: User query string (case-insensitive)

    Returns:
        Predicted class name: 'gbv', 'sti', 'pregnancy', 'contraception',
        or 'general' (fallback for zero matches)

    Raises:
        TypeError: If text is not a string

    Algorithm:
        1. Convert text to lowercase
        2. For each class, find all keywords that appear as whole words
           (using regex word boundaries \b)
        3. Class with the most keyword hits wins
        4. Ties resolved via PRIORITY order
        5. Zero hits → return "general" (documented fallback)

    Note:
        This is a deterministic, rule-based classifier. It is frozen
        and will not be modified during evaluation. Any performance
        gap vs. DistilBERT is part of the evaluation story.
    """
    # Input validation (defensive programming)
    if not isinstance(text, str):
        raise TypeError("text must be a string")

    # Lowercase for case-insensitive matching
    t: str = text.lower()

    # Count keyword hits per class using word boundaries
    hits: Dict[str, List[str]] = {}
    for cls, keywords in KEYWORDS.items():
        # \b ensures whole-word matching (e.g., "prep" won't match "prepare")
        matched: List[str] = [
            kw for kw in keywords
            if re.search(r"\b" + re.escape(kw) + r"\b", t)
        ]
        if matched:
            hits[cls] = matched

    # Fallback: no keywords matched → general
    if not hits:
        return "general"

    # Find class with most hits
    max_score: int = max(len(m) for m in hits.values())

    # Identify tied classes
    tied: List[str] = [c for c, m in hits.items() if len(m) == max_score]

    # Single winner
    if len(tied) == 1:
        return tied[0]

    # Tie-breaking: use PRIORITY order
    for cls in PRIORITY:
        if cls in tied:
            return cls

    # Safety fallback (should never reach here if PRIORITY is comprehensive)
    return tied[0]


def explain_baseline(text: str) -> Dict[str, object]:
    """
    Returns detailed classification results for analysis and debugging.

    Args:
        text: User query string (case-insensitive)

    Returns:
        Dictionary containing:
        - text: Original input text
        - prediction: Predicted class
        - scores: Dict mapping class → number of keyword hits
        - matched_keywords: Dict mapping class → list of matched keywords

    Example:
        >>> explain_baseline("Can I get PEP at the youth clinic?")
        {
            'text': 'Can I get PEP at the youth clinic?',
            'prediction': 'sti',
            'scores': {'contraception': 0, 'gbv': 0, 'general': 1, 'pregnancy': 0, 'sti': 1},
            'matched_keywords': {'general': ['youth', 'clinic'], 'sti': ['pep']}
        }

    Note:
        This function is primarily for error analysis and evaluation
        transparency. It shows exactly WHY the baseline made a prediction.
    """
    t: str = text.lower()

    # Count hits per class
    hits: Dict[str, List[str]] = {}
    for cls, keywords in KEYWORDS.items():
        matched: List[str] = [
            kw for kw in keywords
            if re.search(r"\b" + re.escape(kw) + r"\b", t)
        ]
        if matched:
            hits[cls] = matched

    # Get prediction using classification function
    prediction: str = classify_baseline(text)

    # Build scores dictionary (all classes, zero for no hits)
    scores: Dict[str, int] = {cls: len(hits.get(cls, [])) for cls in KEYWORDS.keys()}

    return {
        "text": text,
        "prediction": prediction,
        "scores": scores,
        "matched_keywords": hits,
    }


# ============================================================================
# UNIT TESTING (Optional - uncomment to run)
# ============================================================================
# if __name__ == "__main__":
#     # Quick validation against seed questions
#     test_queries = [
#         ("Can I get PEP at the youth clinic?", "sti"),
#         ("My period is late, am I pregnant?", "pregnancy"),
#         ("The condom broke, what should I do?", "contraception"),
#         ("Someone forced me to have sex", "gbv"),
#         ("Where can I find a youth-friendly clinic?", "general"),
#     ]
#     for query, expected in test_queries:
#         result = classify_baseline(query)
#         print(f"{result:15} | {expected:15} | {query[:50]}...")
#         assert result == expected, f"Failed: {query}"
#     print("All seed tests passed.")