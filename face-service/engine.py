"""
Face engine – commercial-safe (Apache-2.0) OpenCV Zoo models.

  YuNet  → face detection + 5 landmarks
  SFace  → 128-d L2-normalized face embedding (angular-margin, ArcFace family)

Everything runs on CPU via OpenCV's DNN backend. No InsightFace / research-only
weights are used, so this is safe for commercial deployment.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

import cv2
import numpy as np

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
YUNET_PATH = os.path.join(MODELS_DIR, "face_detection_yunet_2023mar.onnx")
SFACE_PATH = os.path.join(MODELS_DIR, "face_recognition_sface_2021dec.onnx")

EMBEDDING_DIM = 128


@dataclass
class DetectedFace:
    """A detected face: bounding box, 5 landmarks, detector confidence."""

    box: tuple[int, int, int, int]  # x, y, w, h
    landmarks: np.ndarray  # shape (5, 2): right-eye, left-eye, nose, right-mouth, left-mouth
    score: float
    # Full raw YuNet row (15 values) needed by SFace.alignCrop.
    raw: np.ndarray


class FaceEngine:
    """Singleton-ish wrapper around the YuNet detector + SFace recognizer."""

    def __init__(self) -> None:
        if not os.path.exists(YUNET_PATH) or not os.path.exists(SFACE_PATH):
            raise FileNotFoundError(
                "Face models missing. Run `python download_models.py` first."
            )
        # input_size is reset per-image in detect().
        self._detector = cv2.FaceDetectorYN.create(
            YUNET_PATH, "", (320, 320), score_threshold=0.6, nms_threshold=0.3, top_k=5000
        )
        self._recognizer = cv2.FaceRecognizerSF.create(SFACE_PATH, "")

    # ── Detection ────────────────────────────────────────────────────────────
    def detect_largest(self, bgr: np.ndarray) -> Optional[DetectedFace]:
        """Return the largest detected face, or None if no face is found."""
        h, w = bgr.shape[:2]
        self._detector.setInputSize((w, h))
        _, faces = self._detector.detect(bgr)
        if faces is None or len(faces) == 0:
            return None
        # Pick the largest face by bounding-box area.
        largest = max(faces, key=lambda f: float(f[2]) * float(f[3]))
        x, y, bw, bh = (int(largest[0]), int(largest[1]), int(largest[2]), int(largest[3]))
        landmarks = largest[4:14].reshape(5, 2)
        score = float(largest[14])
        return DetectedFace(box=(x, y, bw, bh), landmarks=landmarks, score=score, raw=largest)

    # ── Embedding ──────────────────────────────────────────────────────────────
    def embed(self, bgr: np.ndarray, face: DetectedFace) -> np.ndarray:
        """Align + crop the face and return a 128-d L2-normalized embedding."""
        aligned = self._recognizer.alignCrop(bgr, face.raw)
        feat = self._recognizer.feature(aligned)  # shape (1, 128)
        vec = np.asarray(feat, dtype=np.float32).flatten()
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        return vec

    def embed_from_image(self, bgr: np.ndarray) -> Optional[np.ndarray]:
        """Detect the largest face and return its normalized embedding (or None)."""
        face = self.detect_largest(bgr)
        if face is None:
            return None
        return self.embed(bgr, face)


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity of two (already L2-normalized) vectors → [-1, 1]."""
    if a is None or b is None or a.shape != b.shape:
        return 0.0
    return float(np.dot(a, b))


# ── Liveness helpers (basic, landmark-based) ─────────────────────────────────
def eye_aspect_ratio(landmarks: np.ndarray) -> float:
    """
    Rough openness proxy from YuNet's 5 landmarks: vertical eye-to-nose vs
    inter-eye distance. Not a true EAR (needs 6-pt eyes) but enough to detect
    a gross blink between frames on the client-driven challenge.
    """
    right_eye, left_eye, nose = landmarks[0], landmarks[1], landmarks[2]
    inter_eye = np.linalg.norm(right_eye - left_eye)
    if inter_eye == 0:
        return 0.0
    eye_center = (right_eye + left_eye) / 2.0
    return float(np.linalg.norm(eye_center - nose) / inter_eye)


def head_yaw_proxy(landmarks: np.ndarray) -> float:
    """
    Head-turn proxy: signed horizontal offset of the nose from the eye midpoint,
    normalized by inter-eye distance. Negative→left, positive→right.
    """
    right_eye, left_eye, nose = landmarks[0], landmarks[1], landmarks[2]
    inter_eye = np.linalg.norm(right_eye - left_eye)
    if inter_eye == 0:
        return 0.0
    eye_mid_x = (right_eye[0] + left_eye[0]) / 2.0
    return float((nose[0] - eye_mid_x) / inter_eye)


_engine: Optional[FaceEngine] = None


def get_engine() -> FaceEngine:
    global _engine
    if _engine is None:
        _engine = FaceEngine()
    return _engine
