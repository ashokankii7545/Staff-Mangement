"""
Download the commercial-safe (Apache-2.0) ONNX models from the OpenCV Zoo:
  - YuNet   : face detection
  - SFace   : 128-d face recognition embedding

Run once before starting the service (the Dockerfile does this at build time):
    python download_models.py
"""
from __future__ import annotations

import os
import sys
import urllib.request

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")

# Pinned commits/tags from opencv/opencv_zoo (Apache-2.0). Raw GitHub URLs.
FILES = {
    "face_detection_yunet_2023mar.onnx": (
        "https://github.com/opencv/opencv_zoo/raw/main/models/"
        "face_detection_yunet/face_detection_yunet_2023mar.onnx"
    ),
    "face_recognition_sface_2021dec.onnx": (
        "https://github.com/opencv/opencv_zoo/raw/main/models/"
        "face_recognition_sface/face_recognition_sface_2021dec.onnx"
    ),
}


def main() -> int:
    os.makedirs(MODELS_DIR, exist_ok=True)
    for name, url in FILES.items():
        dest = os.path.join(MODELS_DIR, name)
        if os.path.exists(dest) and os.path.getsize(dest) > 0:
            print(f"✓ {name} already present")
            continue
        print(f"↓ downloading {name} …")
        try:
            urllib.request.urlretrieve(url, dest)
            print(f"✓ saved {name} ({os.path.getsize(dest)} bytes)")
        except Exception as exc:  # noqa: BLE001
            print(f"✗ failed to download {name}: {exc}", file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
