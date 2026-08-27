FROM python:3.11-slim

# OpenCV headless still needs a couple of system libs at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 libgl1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Fetch the Apache-2.0 ONNX models at build time so the image is self-contained.
RUN python download_models.py

EXPOSE 8000
# Render/Railway inject $PORT; default to 8000 locally.
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}"]
