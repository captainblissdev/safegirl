"""
SafeGirl — DistilBERT Classifier Inference Service
===================================================

Loads the final V2 DistilBERT checkpoint and exposes intent
classification through a small HTTP API.

Architecture
------------
The classifier runs as a standalone Python/FastAPI service:

    Express backend
          |
          | POST /classify
          v
    FastAPI classifier service
          |
          v
    V2 DistilBERT model
          |
          v
    Intent + confidence scores

The Express backend does not load or execute the PyTorch model directly.

Running locally
---------------
    uvicorn app:app --host 0.0.0.0 --port 8001

The model checkpoint directory is configured through the MODEL_DIR
environment variable.

Example:
    MODEL_DIR=./final uvicorn app:app --host 0.0.0.0 --port 8001

The checkpoint directory must contain the model and tokenizer files
produced by the V2 final training run, including files such as:

    config.json
    model.safetensors
    tokenizer_config.json
    tokenizer.json

Notes
-----
- SafetyNet is intentionally NOT implemented here. It remains a
  separate deterministic safety layer in the SafeGirl backend.
- The model's own id2label configuration is used rather than assuming
  a hard-coded numerical label ordering.
- Inference uses the same maximum sequence length as V2 training.
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
)


# ============================================================================
# Configuration
# ============================================================================

MODEL_DIR = Path(os.environ.get("MODEL_DIR", "./final"))

MODEL_VERSION = os.environ.get("MODEL_VERSION", "v2")

# Must match the value used during V2 training.
MAX_LENGTH = 64

MAX_INPUT_CHARS = 2_000

EXPECTED_LABELS = {
    "contraception",
    "sti",
    "pregnancy",
    "general",
}


# ============================================================================
# Logging
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)

logger = logging.getLogger("safegirl-classifier")


# ============================================================================
# Runtime state
# ============================================================================

DEVICE = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)

model = None
tokenizer = None


# ============================================================================
# API schemas
# ============================================================================

class ClassifyRequest(BaseModel):
    """Request body accepted by the /classify endpoint."""

    text: str = Field(
        ...,
        min_length=1,
        description="User query to classify.",
    )


class ClassifyResponse(BaseModel):
    """Classification result returned by the /classify endpoint."""

    intent: str = Field(
        description="Predicted SafeGirl intent category.",
    )

    confidence: float = Field(
        description="Softmax score of the predicted intent.",
        ge=0.0,
        le=1.0,
    )

    scores: dict[str, float] = Field(
        description="Softmax score for every supported intent.",
    )


# ============================================================================
# Model loading
# ============================================================================

def validate_model_labels(loaded_model) -> None:
    """
    Validate that the checkpoint contains the four expected SafeGirl
    intent categories.

    The numerical ordering of labels is deliberately not hard-coded.
    The mapping stored inside the trained checkpoint remains authoritative.
    """

    raw_id2label = loaded_model.config.id2label

    labels = {
        str(label).strip().lower()
        for label in raw_id2label.values()
    }

    if labels != EXPECTED_LABELS:
        raise RuntimeError(
            "Model label configuration does not match the expected "
            f"SafeGirl V2 categories. Expected {sorted(EXPECTED_LABELS)}, "
            f"but found {sorted(labels)}."
        )


def load_model() -> None:
    """
    Load the tokenizer and trained classifier checkpoint into memory.

    This function is called once when the FastAPI application starts.
    Loading the model once avoids repeatedly reading the checkpoint
    from disk for every classification request.
    """

    global model, tokenizer

    if not MODEL_DIR.exists():
        raise RuntimeError(
            f"MODEL_DIR '{MODEL_DIR}' does not exist. "
            "Set MODEL_DIR to the SafeGirl V2 final checkpoint directory."
        )

    if not MODEL_DIR.is_dir():
        raise RuntimeError(
            f"MODEL_DIR '{MODEL_DIR}' is not a directory: {MODEL_DIR}"
        )

    logger.info(
        "Loading SafeGirl classifier model from '%s' onto %s.",
        MODEL_DIR,
        DEVICE,
    )

    try:
        tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR)

        model = AutoModelForSequenceClassification.from_pretrained(
            MODEL_DIR
        )

        validate_model_labels(model)

        model.to(DEVICE)
        model.eval()

    except Exception as exc:
        # Do not leave a partially initialized model available.
        model = None
        tokenizer = None

        raise RuntimeError(
            f"Failed to load SafeGirl classifier from '{MODEL_DIR}'."
        ) from exc

    logger.info(
        "SafeGirl V2 classifier loaded successfully."
    )

    logger.info(
        "Model labels: %s",
        model.config.id2label,
    )


# ============================================================================
# FastAPI application lifecycle
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI application lifecycle.

    The model is loaded once during application startup and remains
    available for subsequent requests.
    """

    load_model()

    yield

    # Release references during application shutdown.
    global model, tokenizer
    model = None
    tokenizer = None

    logger.info("SafeGirl classifier service shut down.")


app = FastAPI(
    title="SafeGirl Classifier Inference Service",
    description=(
        "Inference API for the SafeGirl V2 multilingual DistilBERT "
        "intent classifier."
    ),
    version=MODEL_VERSION,
    lifespan=lifespan,
)


# ============================================================================
# Health endpoint
# ============================================================================

@app.get("/health")
def health() -> dict[str, str]:
    """
    Return service health and model information.

    This endpoint can be used by the Express backend or deployment
    tooling to determine whether the classifier service is available.
    """

    if model is None:
        return {
            "status": "model_not_loaded",
            "device": str(DEVICE),
            "model_version": MODEL_VERSION,
        }

    return {
        "status": "ok",
        "device": str(DEVICE),
        "model_version": MODEL_VERSION,
    }


# ============================================================================
# Classification endpoint
# ============================================================================

@app.post(
    "/classify",
    response_model=ClassifyResponse,
)
def classify(request: ClassifyRequest) -> ClassifyResponse:
    """
    Classify one SafeGirl user query.

    The trained model returns:
        - the predicted intent,
        - its softmax confidence score,
        - scores for all supported intent categories.
    """

    if model is None or tokenizer is None:
        raise HTTPException(
            status_code=503,
            detail="Classifier model is not loaded.",
        )

    text = request.text.strip()

    if not text:
        raise HTTPException(
            status_code=400,
            detail="text must be non-empty.",
        )

    if len(text) > MAX_INPUT_CHARS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"text exceeds the maximum allowed length of "
                f"{MAX_INPUT_CHARS} characters."
            ),
        )

    # Tokenization settings intentionally match the V2 training pipeline.
    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        padding=True,
        max_length=MAX_LENGTH,
    )

    # Move tokenized tensors to the same device as the model.
    inputs = {
        key: value.to(DEVICE)
        for key, value in inputs.items()
    }

    # Inference does not require gradient computation.
    # inference_mode() is optimized for inference workloads.
    with torch.inference_mode():
        logits = model(**inputs).logits
        probabilities = torch.softmax(logits, dim=-1)[0]

    # The checkpoint's own label mapping is authoritative.
    id2label = {
        int(index): str(label).lower()
        for index, label in model.config.id2label.items()
    }

    scores = {
        id2label[index]: float(probabilities[index])
        for index in range(len(probabilities))
    }

    predicted_id = int(
        torch.argmax(probabilities).item()
    )

    predicted_intent = id2label[predicted_id]
    confidence = float(probabilities[predicted_id])

    return ClassifyResponse(
        intent=predicted_intent,
        confidence=confidence,
        scores=scores,
    )


# ============================================================================
# Local development entry point
# ============================================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8001,
        reload=False,
    )

