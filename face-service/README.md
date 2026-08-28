# Face Service (Staff-Management)

Commercial-safe face recognition microservice used by the Node backend for
selfie-based attendance. All models are Apache-2.0 (OpenCV Zoo) — no
research-only / non-commercial weights.

- **Detection:** YuNet
- **Recognition:** SFace → 128-d L2-normalized embedding (ArcFace family)
- **Liveness:** basic active challenge (blink / head-turn) via landmark analysis
- **Runtime:** CPU only (OpenCV DNN), FastAPI + Uvicorn

## Endpoints

| Method | Path | Body | Returns |
|---|---|---|---|
| GET  | `/health` | – | `{ status, model, dim }` |
| POST | `/api/v1/embed` | multipart `file` | `{ embedding: number[128], score }` |
| POST | `/api/v1/verify` | multipart `file1`, `file2` | `{ similarity, match, threshold }` |
| POST | `/api/v1/liveness` | multipart `files` (burst) | `{ live, yawRange, framesWithFace, ... }` |
| POST | `/api/v1/analyze` | multipart `file` | `{ faceFound, box, landmarks, ear, yaw }` |

`/api/v1/liveness` is HEAD-TURN based: send a short burst of frames while the
user turns their head; a natural yaw range proves a live person (blink is not
reliable with YuNet's 5 landmarks, so head-turn is used instead).

The `/api/v1/embed` contract matches the Node server's
`server/src/shared/utils/face.util.ts`.

## Environment

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `8000` | Listen port (Render/Railway inject this) |
| `FACE_MATCH_THRESHOLD` | `0.40` | SFace cosine cutoff for a same-person match |
| `LIVENESS_YAW_RANGE` | `0.14` | Min head-yaw swing across the burst to count as live |
| `FACE_SERVICE_TOKEN` | _(empty)_ | If set, callers must send `Authorization: Bearer <token>` |

## Run locally

```bash
cd face-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python download_models.py          # one-time model fetch
uvicorn app:app --reload --port 8000
# smoke test:
curl -F "file=@/path/to/selfie.jpg" http://localhost:8000/api/v1/embed
```

## Deploy (Render example)

1. New **Web Service** → point at this repo, root dir `face-service`.
2. Environment: **Docker** (uses the included `Dockerfile`).
3. Set `FACE_SERVICE_TOKEN` to a random secret (and put the same value in the
   Node backend env).
4. After deploy, copy the service URL (e.g. `https://face-xxxx.onrender.com`)
   into the Node backend's `FACE_SERVICE_URL`.

Railway/Fly.io work the same way (Docker deploy). Any always-on host is fine;
avoid pure serverless (cold starts reload the models on every invocation).

## Licensing

YuNet and SFace ONNX weights are redistributed by the OpenCV Zoo under the
**Apache-2.0** license and are safe for commercial use. They are downloaded at
build time (see `download_models.py`) rather than committed here.
