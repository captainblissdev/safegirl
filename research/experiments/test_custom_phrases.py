"""
SafeGirl -- V3.1 quick manual test on fresh, never-seen phrases
=================================================================

Loads the trained final_v3 checkpoint and runs it against a small,
hand-written list of test phrases -- none of which come from seeds.csv,
the reviewed paraphrases, or the euphemism holdout. This is a quick
sanity spot-check, NOT a formal evaluation: no accuracy claim should
be drawn from this the way DR-04 or the holdout numbers can be, since
these phrases were picked by hand, not sampled or reviewed the same
way. Useful for catching obvious regressions or confirming a specific
concept generalizes, nothing more.

Edit PHRASES below to add your own. Run from the project root, same
as train_distilbert_v3.py.
"""

from pathlib import Path

import numpy as np
import torch
from transformers import (
    DistilBertForSequenceClassification,
    DistilBertTokenizerFast,
)

CHECKPOINT_DIR = Path("./safegirl-classifier-checkpoints-v3") / "final_v3"
MAX_LENGTH = 64

# Each entry: (text, your_expected_label_or_None)
# expected label is just for your own reference when reading output --
# it is NOT used to compute any formal metric here.
PHRASES = [
    ("I have a bump down there that won't go away", "sti"),
    ("Something on my private parts keeps coming back no matter what I do", "sti"),
    ("I've missed my monthly and feel sick every morning", "pregnancy"),
    ("My stomach's been off and I haven't seen my period this month", "pregnancy"),
    ("Is the implant thing going to mess with my periods long term", "contraception"),
    ("What happens if I stop the injection after using it for years", "contraception"),
    ("Can I come in without telling anyone at home", "general"),
    ("Is it possible to talk to someone here without my family knowing", "general"),
    # Known-weakness probes -- specifically targeting the two unresolved
    # issues from the holdout inspection, to see if they show up here too:
    ("Does this rod they put in your arm actually stop pregnancy for good", "contraception"),  # literal "pregnancy" word, known trap
    ("Is there a charge if I show up without any money on me", "general"),  # payment/cost phrasing, known trap
]

print(f"Loading model from: {CHECKPOINT_DIR}")
device = "cuda" if torch.cuda.is_available() else "cpu"
tokenizer = DistilBertTokenizerFast.from_pretrained(str(CHECKPOINT_DIR))
model = DistilBertForSequenceClassification.from_pretrained(str(CHECKPOINT_DIR))
model.to(device)
model.eval()

id2label = model.config.id2label
print(f"Model id2label: {id2label}\n")
print("=" * 100)

for text, expected in PHRASES:
    encoding = tokenizer(
        text, truncation=True, padding="max_length",
        max_length=MAX_LENGTH, return_tensors="pt",
    ).to(device)

    with torch.no_grad():
        logits = model(**encoding).logits
        probs = torch.softmax(logits, dim=1).squeeze(0).cpu().numpy()

    predicted_id = int(np.argmax(probs))
    predicted_class = id2label[predicted_id]
    match_marker = ""
    if expected is not None:
        match_marker = " (matches expected)" if predicted_class == expected else " (DIFFERS from expected)"

    print(f"\nText:      {text}")
    if expected is not None:
        print(f"Expected:  {expected}")
    print(f"Predicted: {predicted_class}{match_marker}")
    print("Scores:    " + ", ".join(
        f"{id2label[i]}={probs[i]:.3f}" for i in range(len(probs))
    ))

print("\n" + "=" * 100)
print("\nReminder: this is a hand-picked spot-check, not a formal evaluation.")
print("Use it to catch obvious problems, not to compute a reportable accuracy number.")