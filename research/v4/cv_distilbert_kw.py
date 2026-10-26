"""V4 CV: DistilBERT + keyword evidence (deviation 2 in
docs/decision-log.md).

Run from the repository root, in .venv-train (CUDA), after the four plain
DistilBERT runs exist:

    .venv-train/Scripts/python.exe -I research/v4/cv_distilbert_kw.py

DistilBERT keeps its own pre_classifier, ReLU and dropout; the final
classifier layer becomes Linear(768 + 6, 6) over the first-token
representation concatenated with 6 rule features: the frozen baseline's
5 keyword hit counts and the vague-rule flag, in the e5 hybrid's order
(cv_hybrid.rule_features). A StandardScaler is fitted on those features
for each fold's training rows only, never on the inner or held-out
fold.

The learning rate is the one with the highest mean macro-F1 among the
four plain DistilBERT runs (cv_distilbert_lr{5e-6,1e-5,2e-5,3e-5}.json);
a tie goes to the lower rate. Max 12 epochs. Everything else is the step
2 procedure in cv_distilbert.py (inner fold, patience 2, label smoothing
0.1, weight decay 0.01, balanced class weights, batch 16, max length 64,
10% warmup, seed 42, no V1 paraphrases).

Writes research/v4/results/cv_distilbert_kw_lr<lr>.json and _oof.csv.
"""

from __future__ import annotations

import argparse
import functools
import importlib.util
import json
import os
import sys
import time
from pathlib import Path

import numpy as np
from sklearn.preprocessing import StandardScaler

HERE = Path(__file__).resolve().parent
MAX_EPOCHS = 12
PLAIN_LRS = ("5e-6", "1e-5", "2e-5", "3e-5")


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


cvd = _load("cv_distilbert", HERE / "cv_distilbert.py")
hy = _load("cv_hybrid", HERE / "cv_hybrid.py")
cv = cvd.cv
RULE_COLUMNS = tuple(hy.KEYWORD_CLASSES) + ("vague",)


@functools.lru_cache(maxsize=None)
def rule_features(text: str) -> tuple[float, ...]:
    """cv_hybrid.rule_features, computed once per text."""
    return tuple(hy.rule_features(text))


def choose_lr(results=cv.RESULTS_DIR):
    """(tag, {tag: mean macro-F1}): the best plain DistilBERT lr; a tie
    goes to the lower rate."""
    means = {t: json.loads((results / f"cv_distilbert_lr{t}.json").read_text(encoding="utf-8"))["macro_f1_mean"]
             for t in PLAIN_LRS}
    top = max(means.values())
    return min((t for t in PLAIN_LRS if means[t] == top), key=cvd.LRS.get), means


def fold_inputs(data, held_out):
    """Rows and scaled rule features for one held-out fold. The scaler is
    fitted on the training rows only."""
    train, val, test = cvd.split(data, held_out)
    raw = {name: np.array([rule_features(x["text"]) for x in rows]) for name, rows in
           (("train", train), ("val", val), ("test", test))}
    scaler = StandardScaler().fit(raw["train"])
    return {"train": train, "val": val, "test": test, "scaler": scaler,
            **{f"{k}_feats": scaler.transform(v).astype(np.float32) for k, v in raw.items()}}


def kw_model(base):
    """Wrap a DistilBertForSequenceClassification: its encoder,
    pre_classifier and dropout, and a new Linear(dim + 6, num_labels)."""
    import torch

    class KwDistilBert(torch.nn.Module):
        def __init__(self, base):
            super().__init__()
            self.distilbert = base.distilbert
            self.pre_classifier = base.pre_classifier
            self.dropout = base.dropout
            self.classifier = torch.nn.Linear(base.config.dim + len(RULE_COLUMNS), base.config.num_labels)
            # the same initialisation as the Hugging Face classifier layer
            torch.nn.init.normal_(self.classifier.weight, std=base.config.initializer_range)
            torch.nn.init.zeros_(self.classifier.bias)

        def forward(self, input_ids, attention_mask, feats):
            h = self.distilbert(input_ids=input_ids, attention_mask=attention_mask).last_hidden_state[:, 0]
            h = self.dropout(torch.relu(self.pre_classifier(h)))
            return self.classifier(torch.cat([h, feats], dim=-1))

    return KwDistilBert(base)


def predict(model, tok, texts, feats, device):
    import torch

    model.eval()
    out = []
    with torch.no_grad():
        for i in range(0, len(texts), 64):
            enc = tok(texts[i:i + 64], padding="max_length", truncation=True, max_length=cvd.MAX_LENGTH,
                      return_tensors="pt").to(device)
            f = torch.from_numpy(feats[i:i + 64]).to(device)
            out.append(torch.softmax(model(enc["input_ids"], enc["attention_mask"], f).float(), dim=-1).cpu())
    return torch.cat(out).numpy()


def train_fold(data, held_out, lr, device, max_epochs=MAX_EPOCHS):
    import torch
    from transformers import AutoModelForSequenceClassification, AutoTokenizer, get_linear_schedule_with_warmup

    started = time.perf_counter()
    inputs = fold_inputs(data, held_out)
    train, val, test = inputs["train"], inputs["val"], inputs["test"]
    cvd.set_seed()
    tok = AutoTokenizer.from_pretrained(cvd.MODEL)
    base = AutoModelForSequenceClassification.from_pretrained(
        cvd.MODEL, num_labels=len(cv.CLASSES), id2label=dict(enumerate(cv.CLASSES)),
        label2id={c: i for i, c in enumerate(cv.CLASSES)})
    model = kw_model(base).to(device)
    index = {c: i for i, c in enumerate(cv.CLASSES)}
    texts = [x["text"] for x in train]
    feats = torch.from_numpy(inputs["train_feats"])
    y = torch.tensor([index[x["cls"]] for x in train])
    weights = cvd.balanced_weights([x["cls"] for x in train])
    loss_fn = torch.nn.CrossEntropyLoss(weight=torch.tensor(weights, device=device),
                                        label_smoothing=cvd.LABEL_SMOOTHING)
    no_decay = ("bias", "LayerNorm.weight")
    groups = [{"params": [p for n, p in model.named_parameters() if not n.endswith(no_decay)],
               "weight_decay": cvd.WEIGHT_DECAY},
              {"params": [p for n, p in model.named_parameters() if n.endswith(no_decay)], "weight_decay": 0.0}]
    optimizer = torch.optim.AdamW(groups, lr=lr)
    steps_per_epoch = -(-len(train) // cvd.BATCH)
    total = steps_per_epoch * max_epochs
    scheduler = get_linear_schedule_with_warmup(optimizer, int(cvd.WARMUP_RATIO * total), total)
    order = torch.Generator().manual_seed(cvd.SEED)

    curve, best, best_epoch, best_state, stale = [], -1.0, 0, None, 0
    for epoch in range(1, max_epochs + 1):
        model.train()
        for batch in torch.randperm(len(train), generator=order).split(cvd.BATCH):
            enc = tok([texts[i] for i in batch], padding="max_length", truncation=True,
                      max_length=cvd.MAX_LENGTH, return_tensors="pt").to(device)
            logits = model(enc["input_ids"], enc["attention_mask"], feats[batch].to(device))
            loss = loss_fn(logits, y[batch].to(device))
            loss.backward()
            optimizer.step()
            scheduler.step()
            optimizer.zero_grad()
        proba = predict(model, tok, [x["text"] for x in val], inputs["val_feats"], device)
        score = cv.macro_f1([x["cls"] for x in val], cvd.labels_of(proba))
        curve.append(score)
        print(f"  fold {held_out} epoch {epoch}: inner macro-F1 {score:.4f}", flush=True)
        if score > best:
            best, best_epoch, stale = score, epoch, 0
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
        else:
            stale += 1
            if stale >= cvd.PATIENCE:
                break

    model.load_state_dict(best_state)
    proba = predict(model, tok, [x["text"] for x in test], inputs["test_feats"], device)
    oof = [{"seed_id": s["seed_id"], "fold": held_out, "true": s["cls"], "pred": cv.CLASSES[int(p.argmax())],
            "confidence": float(p.max())} for s, p in zip(test, proba)]
    sc = inputs["scaler"]
    info = {"inner_fold": cvd.inner_fold(held_out), "train_rows": len(train), "val_seeds": len(val),
            "test_seeds": len(test), "class_weights": dict(zip(cv.CLASSES, weights)),
            "scaler_mean": dict(zip(RULE_COLUMNS, sc.mean_.tolist())),
            "scaler_scale": dict(zip(RULE_COLUMNS, sc.scale_.tolist())), "scaler_rows": int(sc.n_samples_seen_),
            "steps_per_epoch": steps_per_epoch, "warmup_steps": int(cvd.WARMUP_RATIO * total),
            "planned_steps": total, "epochs_run": len(curve), "best_epoch": best_epoch,
            "best_inner_macro_f1": best, "inner_macro_f1_per_epoch": curve,
            "ran_to_cap": len(curve) == max_epochs, "best_at_cap": best_epoch == max_epochs,
            "seconds": round(time.perf_counter() - started, 1)}
    del model, base, best_state
    torch.cuda.empty_cache()
    return oof, info


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--folds", type=int, nargs="+", default=list(cv.FOLDS))
    ap.add_argument("--out-dir", type=Path, default=cv.RESULTS_DIR)
    args = ap.parse_args(argv)
    tag, means = choose_lr()
    print(f"plain DistilBERT mean macro-F1: {means}; lr {tag}", flush=True)
    os.environ.setdefault("CUBLAS_WORKSPACE_CONFIG", ":4096:8")
    import torch

    torch.use_deterministic_algorithms(True)
    torch.backends.cudnn.benchmark = False
    device = "cuda" if torch.cuda.is_available() else "cpu"
    data = cv.load_data()
    oof, folds = [], {}
    for k in args.folds:
        rows, info = train_fold(data, k, cvd.LRS[tag], device)
        oof += rows
        folds[str(k)] = info
        print(f"  fold {k}: best epoch {info['best_epoch']}, {info['seconds']} s", flush=True)
    config = {"model": f"{cvd.MODEL} + keyword evidence", "head": f"Linear(768 + {len(RULE_COLUMNS)}, 6)",
              "rule_features": list(RULE_COLUMNS),
              "scaler": "StandardScaler on the rule features, fitted on each fold's training rows",
              "lr": cvd.LRS[tag], "lr_choice": {"plain_distilbert_macro_f1": means, "chosen": tag,
                                                  "rule": "highest mean macro-F1, a tie goes to the lower rate"},
              "max_epochs": MAX_EPOCHS, "patience": cvd.PATIENCE, "batch": cvd.BATCH, "max_length": cvd.MAX_LENGTH,
              "weight_decay": cvd.WEIGHT_DECAY, "label_smoothing": cvd.LABEL_SMOOTHING,
              "class_weights": "balanced, from each fold's training rows, in the loss",
              "warmup": f"linear schedule, {cvd.WARMUP_RATIO:.0%} warmup over the planned {MAX_EPOCHS} epochs",
              "seed": cvd.SEED, "training_set": "without V1 restore paraphrases",
              "inner_fold": "next fold, wrapping 5 -> 1", "grid": "deviation 2 (docs/decision-log.md)",
              "checkpoints": "best epoch kept in memory only, never saved", "folds": folds,
              "best_epochs": [folds[str(k)]["best_epoch"] for k in args.folds],
              "folds_ran_to_cap": [k for k in args.folds if folds[str(k)]["ran_to_cap"]],
              "folds_best_at_cap": [k for k in args.folds if folds[str(k)]["best_at_cap"]],
              "total_seconds": round(sum(f["seconds"] for f in folds.values()), 1), "hardware": cvd.hardware()}
    if args.folds == list(cv.FOLDS):
        s = cv.write_results(f"distilbert_kw_lr{tag}", oof, config, out_dir=args.out_dir)
        print(f"distilbert_kw lr {tag}: macro-F1 {s['macro_f1_mean']:.4f} +/- {s['macro_f1_sd']:.4f}; "
              f"sti {s['sti_recall']:.3f}; pregnancy {s['pregnancy_recall']:.3f}; "
              f"confident-wrong {s['confident_wrong']:.3f}; ECE {s['ece']:.3f}", flush=True)
    else:
        args.out_dir.mkdir(parents=True, exist_ok=True)
        with open(args.out_dir / f"partial_kw_lr{tag}_oof.csv", "w", encoding="utf-8", newline="") as f:
            f.write("seed_id,fold,true,pred,confidence\n")
            for r in sorted(oof, key=lambda r: (r["fold"], r["seed_id"])):
                f.write(f"{r['seed_id']},{r['fold']},{r['true']},{r['pred']},{r['confidence']:.6f}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
