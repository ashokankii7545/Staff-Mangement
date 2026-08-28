"""
Face-service – FastAPI app exposing commercial-safe (Apache-2.0) face
detection (YuNet) + recognition (SFace, 128-d) + basic liveness helpers.

Endpoints (versioned under /api/v1 to match the Node server's existing
FACE_SERVICE_URL contract in server/src/shared/utils/face.util.ts):

  GET  /health                      → { status, model, dim }
  POST /api/v1/embed   (file)       → { embedding: number[128], score }
  POST /api/v1/verify  (file1,file2)→ { similarity, match, threshold }
  POST /api/v1/analyze (file)       → { faceFound, box, landmarks, ear, yaw }

Auth: optional shared secret via the FACE_SERVICE_TOKEN env var. When set,
callers must send `Authorization: Bearer <token>`.
"""
from __future__ import annotations

import io
import os
from typing import Optional

import cv2
import numpy as np
from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

from engine import (
    EMBEDDING_DIM,
    cosine_similarity,
    eye_aspect_ratio,
    get_engine,
    head_yaw_proxy,
)

# SFace cosine threshold: OpenCV's recommended same-identity cutoff is ~0.363.
# Slightly higher (stricter) default to reduce false accepts for attendance.
MATCH_THRESHOLD = float(os.getenv("FACE_MATCH_THRESHOLD", "0.40"))
SERVICE_TOKEN = os.getenv("FACE_SERVICE_TOKEN", "").strip()

app = FastAPI(title="Staff-Management Face Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # server-to-server; tighten if called from browser
    allow_methods=["*"],
    allow_headers=["*"],
)


def require_token(authorization: Optional[str] = Header(default=None)) -> None:
    """Optional bearer-token guard – enabled only when FACE_SERVICE_TOKEN is set."""
    if not SERVICE_TOKEN:
        return
    expected = f"Bearer {SERVICE_TOKEN}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="Invalid or missing service token")


def _read_image(data: bytes) -> np.ndarray:
    """Decode arbitrary image bytes → BGR ndarray (handles PNG/JPEG/etc.)."""
    try:
        img = Image.open(io.BytesIO(data)).convert("RGB")
        rgb = np.array(img)
        return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Unreadable image: {exc}")


@app.get("/health")
def health() -> dict:
    # Touch the engine so a broken model surfaces as an unhealthy check.
    try:
        get_engine()
        ok = True
    except Exception:  # noqa: BLE001
        ok = False
    return {"status": "ok" if ok else "degraded", "model": "sface+yunet", "dim": EMBEDDING_DIM}


@app.post("/api/v1/embed", dependencies=[Depends(require_token)])
async def embed(file: UploadFile = File(...)) -> dict:
    """Return the 128-d embedding of the largest face in the image."""
    engine = get_engine()
    bgr = _read_image(await file.read())
    face = engine.detect_largest(bgr)
    if face is None:
        raise HTTPException(status_code=422, detail="No face detected in image")
    vec = engine.embed(bgr, face)
    return {"embedding": vec.tolist(), "score": face.score, "dim": EMBEDDING_DIM}


@app.post("/api/v1/verify", dependencies=[Depends(require_token)])
async def verify(
    file1: UploadFile = File(...),
    file2: UploadFile = File(...),
) -> dict:
    """Compare two face images and return cosine similarity + match decision."""
    engine = get_engine()
    a = engine.embed_from_image(_read_image(await file1.read()))
    b = engine.embed_from_image(_read_image(await file2.read()))
    if a is None or b is None:
        raise HTTPException(status_code=422, detail="Face not detected in one or both images")
    sim = cosine_similarity(a, b)
    return {"similarity": sim, "match": sim >= MATCH_THRESHOLD, "threshold": MATCH_THRESHOLD}


# Head-turn liveness: the head-yaw proxy (nose offset from eye midpoint) must
# span at least this range across the burst to prove natural head motion.
# YuNet's 5 landmarks measure yaw reliably (unlike eyelid/blink), so head-turn
# is the robust active-liveness signal for our commercial-safe models.
LIVENESS_YAW_RANGE = float(os.getenv("LIVENESS_YAW_RANGE", "0.14"))


@app.post("/api/v1/liveness", dependencies=[Depends(require_token)])
async def liveness(files: list[UploadFile] = File(...)) -> dict:
    """
    Active liveness from a short burst of frames via HEAD-TURN motion.

    The user turns their head left↔right; we track the head-yaw proxy (nose
    horizontal offset from the eye midpoint, normalized by inter-eye distance)
    across frames. A natural turn produces a yaw range a held-up still photo
    can't replicate on command. Relative/normalized so it adapts to any face.

    Returns { live, yawRange, framesWithFace, totalFrames, minYaw, maxYaw }.
    """
    engine = get_engine()
    yaws: list[float] = []
    for f in files:
        bgr = _read_image(await f.read())
        face = engine.detect_largest(bgr)
        if face is not None:
            yaws.append(head_yaw_proxy(face.landmarks))

    total = len(files)
    with_face = len(yaws)
    if with_face < 3:
        return {
            "live": False,
            "framesWithFace": with_face,
            "totalFrames": total,
            "reason": "insufficient_face_frames",
        }

    min_yaw = min(yaws)
    max_yaw = max(yaws)
    yaw_range = max_yaw - min_yaw
    live = yaw_range >= LIVENESS_YAW_RANGE

    return {
        "live": live,
        "yawRange": round(yaw_range, 4),
        "framesWithFace": with_face,
        "totalFrames": total,
        "minYaw": round(min_yaw, 4),
        "maxYaw": round(max_yaw, 4),
        "threshold": LIVENESS_YAW_RANGE,
    }


@app.post("/api/v1/analyze", dependencies=[Depends(require_token)])
async def analyze(file: UploadFile = File(...)) -> dict:
    """
    Landmark analysis used by the active-liveness challenge: reports whether a
    face is present plus eye-openness (ear) and head-yaw proxies so the client
    can score blink / head-turn gestures frame-by-frame.
    """
    engine = get_engine()
    bgr = _read_image(await file.read())
    face = engine.detect_largest(bgr)
    if face is None:
        return {"faceFound": False}
    x, y, w, h = face.box
    return {
        "faceFound": True,
        "box": {"x": x, "y": y, "w": w, "h": h},
        "score": face.score,
        "landmarks": face.landmarks.tolist(),
        "ear": eye_aspect_ratio(face.landmarks),
        "yaw": head_yaw_proxy(face.landmarks),
    }
