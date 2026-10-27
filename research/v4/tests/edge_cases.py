"""Synthetic edge-case strings for the Node-vs-Python parity tests (vague
rule and keyword counts). All are written for these tests; none comes
from a user, a test set or the sealed set."""

EDGE_CASES = {
    "accents": ["Café?", "my período is late", "naïve question", "Où est la clinique",
                "ÉTÉ", "is my períod normal?", "contracepción", "clínica",
                # a keyword directly followed by an accented letter
                "pillé", "hivé test", "condomé ya kike"],
    "non_ascii_letters": ["Привет", "你好", "مرحبا", "Γειά σου", "İstanbul", "straße", "ǅemal",
                          "ﬁne thanks"],
    "apostrophes": ["I’m worried", "I'm worried", "it’s fine", "Don‘t know", "can’t sleep",
                    "ʼok", "I`m scared", "what’s PrEP"],
    "mixed_case": ["AM I OKAY", "aM i OkAy", "PrEP?", "HiV", "PERIOD PAIN", "Condom BROKE"],
    "whitespace": ["  am   i   okay  ", "am\ni\nokay", "\tam i okay\t", "\n\n", "period\r\npain",
                   "am i okay", "am i okay"],
    "emoji": ["😢", "help 🙏", "am i okay 😟", "period 🩸", "🤔🤔", "pregnant? 🤰"],
    "very_short": ["a", "?", "hi", "ok", "x", "hiv"],
    "very_long": [" ".join(["um"] * 400), " ".join(["period pain"] * 150),
                  "I have a question " * 60 + "about condoms"],
    "swahili_sheng": ["niko poa", "sijui nifanye nini", "naomba msaada", "mimi ni mjamzito",
                      "nina swali", "sasa msee", "uko aje", "ni kawaida?", "nimechelewa period",
                      "nataka condom", "nina ukimwi?", "mtu ananiforce"],
    "punctuation_only": ["???", "...", "!!!", "-_-", "?!.,;:", "''", "“”"],
}


def all_cases():
    """[(case id, text)] in a fixed order."""
    return [(f"{group}-{i}", text) for group, texts in EDGE_CASES.items() for i, text in enumerate(texts)]
