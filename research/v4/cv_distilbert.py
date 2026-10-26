"""V4 CV: DistilBERT (distilbert-base-multilingual-cased), 6 classes.

Run from the repository root, in .venv-train (CUDA):

    .venv-train/Scripts/python.exe -I research/v4/cv_distilbert.py

The grid is fixed in docs/decision-log.md, "V4 pre-registration:
clarification 2 (2026-10-26)", item 4. The training set is without the
V1 restore paraphrases (the step 1 ablation). For each held-out fold k:

- the inner validation fold is the next fold, wrapping 5 -> 1 (the
  brief's "(k+1) mod 5" on folds numbered 1..5);
- training rows are the seeds and paraphrases of the other three
  folds; validation rows are the inner fold's SEEDS only;
- each epoch is scored on the inner fold by macro-F1; at most 8 epochs,
  patience 2, and the best epoch's weights (kept in memory, never
  written to disk) score the held-out fold's SEEDS once. There is no
  retraining on all four folds.

Fixed: batch 16, max length 64, AdamW with weight decay 0.01 (not on
biases or LayerNorm weights, as in the Hugging Face Trainer), label
smoothing 0.1, balanced class weights from the fold's training rows in
the loss, seed 42 for python, numpy, torch and the data order, and a
linear schedule with 10% warmup over the planned 8 epochs. V3 defined
WARMUP_RATIO but never passed it to its trainer; here it is applied.
Confidence is the top softmax probability.

Writes research/v4/results/cv_distilbert_lr5e-6.json,
cv_distilbert_lr1e-5.json and their _oof.csv files. --folds and
--out-dir rerun some folds elsewhere (for the determinism check).

torch and transformers are imported only inside the training code, so
the split and weight logic can be tested without them.
"""

from __future__ import annotations

import argparse
import copy
import importlib.metadata
import importlib.util
import os
import random
import sys
import time
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
MODEL = "distilbert-base-multilingual-cased"
LRS = {"5e-6": 5e-6, "1e-5": 1e-5}
MAX_EPOCHS = 8
PATIENCE = 2
BATCH = 16
MAX_LENGTH = 64
WEIGHT_DECAY = 0.01
LABEL_SMOOTHING = 0.1
WARMUP_RATIO = 0.1
SEED = 42


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


cv = _load("cv_common", HERE / "cv_common.py")


# ----------------------------------------------------------------- split


def inner_fold(held_out: int) -> int:
    """The fold after the held-out one, wrapping 5 -> 1."""
    return held_out % len(cv.FOLDS) + 1


def split(data: dict, held_out: int):
    """(train, validation, test) rows for one held-out fold."""
    inner = inner_fold(held_out)
    train = [x for x in cv.train_rows(data, held_out) if x["fold"] != inner]
    val = cv.eval_rows(data, inner)
    test = cv.eval_rows(data, held_out)
    return train, val, test


def balanced_weights(labels, classes=cv.CLASSES) -> list[float]:
    """n / (n_classes * count), as sklearn's class_weight="balanced", in
    classes order. Every class must appear."""
    counts = Counter(labels)
    missing = [c for c in classes if not counts[c]]
    assert not missing, f"no training rows for {missing}"
    return [len(labels) / (len(classes) * counts[c]) for c in classes]


# -------------------------------------------------------------- training


def set_seed(seed: int = SEED) -> None:
    import numpy as np
    import torch

    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


def predict(model, tok, texts, device):
    import torch

    model.eval()
    out = []
    with torch.no_grad():
        for i in range(0, len(texts), 64):
            enc = tok(texts[i:i + 64], padding="max_length", truncation=True, max_length=MAX_LENGTH,
                      return_tensors="pt").to(device)
            out.append(torch.softmax(model(**enc).logits.float(), dim=-1).cpu())
    return torch.cat(out).numpy()


def labels_of(proba):
    return [cv.CLASSES[i] for i in proba.argmax(axis=1)]


def train_fold(data, held_out, lr, device):
    import torch
    from transformers import AutoModelForSequenceClassification, AutoTokenizer, get_linear_schedule_with_warmup

    started = time.perf_counter()
    train, val, test = split(data, held_out)
    set_seed()
    tok = AutoTokenizer.from_pretrained(MODEL)
    model = AutoModelForSequenceClassification.from_pretrained(
        MODEL, num_labels=len(cv.CLASSES), id2label=dict(enumerate(cv.CLASSES)),
        label2id={c: i for i, c in enumerate(cv.CLASSES)}).to(device)
    index = {c: i for i, c in enumerate(cv.CLASSES)}
    texts = [x["text"] for x in train]
    y = torch.tensor([index[x["cls"]] for x in train])
    weights = balanced_weights([x["cls"] for x in train])
    loss_fn = torch.nn.CrossEntropyLoss(weight=torch.tensor(weights, device=device),
                                        label_smoothing=LABEL_SMOOTHING)
    no_decay = ("bias", "LayerNorm.weight")
    groups = [{"params": [p for n, p in model.named_parameters() if not n.endswith(no_decay)],
               "weight_decay": WEIGHT_DECAY},
              {"params": [p for n, p in model.named_parameters() if n.endswith(no_decay)], "weight_decay": 0.0}]
    optimizer = torch.optim.AdamW(groups, lr=lr)
    steps_per_epoch = -(-len(train) // BATCH)
    total = steps_per_epoch * MAX_EPOCHS
    scheduler = get_linear_schedule_with_warmup(optimizer, int(WARMUP_RATIO * total), total)
    order = torch.Generator().manual_seed(SEED)

    curve, best, best_epoch, best_state, stale = [], -1.0, 0, None, 0
    for epoch in range(1, MAX_EPOCHS + 1):
        model.train()
        for batch in torch.randperm(len(train), generator=order).split(BATCH):
            enc = tok([texts[i] for i in batch], padding="max_length", truncation=True,
                      max_length=MAX_LENGTH, return_tensors="pt").to(device)
            loss = loss_fn(model(**enc).logits, y[batch].to(device))
            loss.backward()
            optimizer.step()
            scheduler.step()
            optimizer.zero_grad()
        score = cv.macro_f1([x["cls"] for x in val], labels_of(predict(model, tok, [x["text"] for x in val], device)))
        curve.append(score)
        print(f"  fold {held_out} epoch {epoch}: inner macro-F1 {score:.4f}", flush=True)
        if score > best:
            best, best_epoch, stale = score, epoch, 0
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
        else:
            stale += 1
            if stale >= PATIENCE:
                break

    model.load_state_dict(best_state)
    proba = predict(model, tok, [x["text"] for x in test], device)
    oof = [{"seed_id": s["seed_id"], "fold": held_out, "true": s["cls"], "pred": cv.CLASSES[int(p.argmax())],
            "confidence": float(p.max())} for s, p in zip(test, proba)]
    info = {"inner_fold": inner_fold(held_out), "train_rows": len(train), "val_seeds": len(val),
            "test_seeds": len(test), "class_weights": dict(zip(cv.CLASSES, weights)),
            "steps_per_epoch": steps_per_epoch, "warmup_steps": int(WARMUP_RATIO * total),
            "planned_steps": total, "epochs_run": len(curve), "best_epoch": best_epoch,
            "best_inner_macro_f1": best, "inner_macro_f1_per_epoch": curve,
            "seconds": round(time.perf_counter() - started, 1)}
    del model, best_state
    torch.cuda.empty_cache()
    return oof, info


def hardware():
    import torch

    versions = {p: importlib.metadata.version(p) for p in ("torch", "transformers", "scikit-learn")}
    return {"versions": versions, "cuda": torch.version.cuda,
            "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
            "deterministic_algorithms": torch.are_deterministic_algorithms_enabled()}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--lr", choices=sorted(LRS), action="append", help="default: both")
    ap.add_argument("--folds", type=int, nargs="+", default=list(cv.FOLDS))
    ap.add_argument("--out-dir", type=Path, default=cv.RESULTS_DIR)
    args = ap.parse_args(argv)
    # Needed by torch.use_deterministic_algorithms on CUDA; set before torch starts.
    os.environ.setdefault("CUBLAS_WORKSPACE_CONFIG", ":4096:8")
    import torch

    torch.use_deterministic_algorithms(True)
    torch.backends.cudnn.benchmark = False
    device = "cuda" if torch.cuda.is_available() else "cpu"
    data = cv.load_data()
    for tag in args.lr or sorted(LRS, key=LRS.get):
        print(f"lr {tag}", flush=True)
        oof, folds = [], {}
        for k in args.folds:
            rows, info = train_fold(data, k, LRS[tag], device)
            oof += rows
            folds[str(k)] = info
            print(f"  fold {k}: best epoch {info['best_epoch']}, {info['seconds']} s", flush=True)
        config = {"model": MODEL, "lr": LRS[tag], "max_epochs": MAX_EPOCHS, "patience": PATIENCE, "batch": BATCH,
                  "max_length": MAX_LENGTH, "weight_decay": WEIGHT_DECAY, "label_smoothing": LABEL_SMOOTHING,
                  "class_weights": "balanced, from each fold's training rows, in the loss",
                  "warmup": f"linear schedule, {WARMUP_RATIO:.0%} warmup over the planned {MAX_EPOCHS} epochs",
                  "warmup_note": "V3 defined WARMUP_RATIO but never passed it to its trainer; V4 applies it",
                  "seed": SEED, "training_set": "without V1 restore paraphrases",
                  "inner_fold": "next fold, wrapping 5 -> 1",
                  "checkpoints": "best epoch kept in memory only, never saved", "folds": folds,
                  "best_epochs": [folds[str(k)]["best_epoch"] for k in args.folds],
                  "total_seconds": round(sum(f["seconds"] for f in folds.values()), 1), "hardware": hardware()}
        if args.folds == list(cv.FOLDS):
            s = cv.write_results(f"distilbert_lr{tag}", oof, config, out_dir=args.out_dir)
            print(f"lr {tag}: macro-F1 {s['macro_f1_mean']:.4f} +/- {s['macro_f1_sd']:.4f}; "
                  f"sti {s['sti_recall']:.3f}; pregnancy {s['pregnancy_recall']:.3f}; "
                  f"confident-wrong {s['confident_wrong']:.3f}; ECE {s['ece']:.3f}", flush=True)
        else:
            args.out_dir.mkdir(parents=True, exist_ok=True)
            with open(args.out_dir / f"partial_lr{tag}_oof.csv", "w", encoding="utf-8", newline="") as f:
                f.write("seed_id,fold,true,pred,confidence\n")
                for r in sorted(oof, key=lambda r: (r["fold"], r["seed_id"])):
                    f.write(f"{r['seed_id']},{r['fold']},{r['true']},{r['pred']},{r['confidence']:.6f}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
