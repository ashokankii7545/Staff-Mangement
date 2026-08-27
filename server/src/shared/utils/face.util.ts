import { env } from '../../config/env.js';
import { logger } from '../logger/logger.js';

/**
 * Client for the commercial-safe (Apache-2.0) face microservice.
 *   Detection: YuNet · Recognition: SFace → 128-d L2-normalized embedding.
 * Contract: POST multipart `file` to `${FACE_SERVICE_URL}/api/v1/embed`
 * returning `{ embedding: number[128] }`. When FACE_SERVICE_URL is unset the
 * feature is OFF and callers treat a null embedding as non-fatal.
 */

/** Cosine-similarity cutoff for a same-person match (mirrors the service default). */
export const FACE_MATCH_THRESHOLD = 0.4;

const base64ToBlob = (base64Image: string): Blob => {
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');
  return new Blob([buffer], { type: 'image/jpeg' });
};

const authHeaders = (): Record<string, string> =>
  env.faceServiceToken ? { Authorization: `Bearer ${env.faceServiceToken}` } : {};

/** Extract a 128-d face embedding from a base64 image, or null if unavailable. */
export async function getFaceEmbeddingFromBase64(base64Image: string): Promise<number[] | null> {
  if (!env.faceServiceUrl) {
    logger.debug('FACE_SERVICE_URL not set – skipping face embedding extraction.');
    return null;
  }

  try {
    const formData = new FormData();
    formData.append('file', base64ToBlob(base64Image), 'image.jpg');

    const response = await fetch(`${env.faceServiceUrl.replace(/\/$/, '')}/api/v1/embed`, {
      method: 'POST',
      body: formData,
      headers: authHeaders(),
    });

    if (!response.ok) {
      // 422 = no face detected (expected sometimes); log at warn, return null.
      logger.warn(`Face service /embed returned ${response.status}: ${await response.text()}`);
      return null;
    }

    const data = (await response.json()) as { embedding?: number[] };
    return Array.isArray(data?.embedding) && data.embedding.length ? data.embedding : null;
  } catch (error) {
    logger.error('Failed to extract face embedding', error);
    return null;
  }
}

/** Extract a 128-d embedding from an image URL (fetches the image first). Null on failure. */
export async function getFaceEmbeddingFromUrl(imageUrl: string): Promise<number[] | null> {
  if (!env.faceServiceUrl || !imageUrl) return null;
  try {
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      logger.warn(`Could not fetch avatar for enrollment (${imgRes.status}): ${imageUrl}`);
      return null;
    }
    const arrayBuffer = await imgRes.arrayBuffer();
    const formData = new FormData();
    formData.append('file', new Blob([arrayBuffer]), 'image.jpg');

    const response = await fetch(`${env.faceServiceUrl.replace(/\/$/, '')}/api/v1/embed`, {
      method: 'POST',
      body: formData,
      headers: authHeaders(),
    });
    if (!response.ok) {
      logger.warn(`Face service /embed returned ${response.status} for ${imageUrl}`);
      return null;
    }
    const data = (await response.json()) as { embedding?: number[] };
    return Array.isArray(data?.embedding) && data.embedding.length ? data.embedding : null;
  } catch (error) {
    logger.error('Failed to extract face embedding from URL', error);
    return null;
  }
}

/**
 * Server-side active liveness: send a burst of frames to the face-service which
 * confirms a natural head-turn (yaw motion a held-up photo can't produce).
 * Returns null when the service is off or no frames given (→ caller skips the
 * check); otherwise `{ live, yawRange }`. Never throws.
 */
export async function checkLiveness(
  frames: string[],
): Promise<{ live: boolean; yawRange?: number } | null> {
  if (!env.faceServiceUrl || !frames || frames.length === 0) return null;
  try {
    const formData = new FormData();
    frames.forEach((f, i) => formData.append('files', base64ToBlob(f), `frame${i}.jpg`));

    const response = await fetch(`${env.faceServiceUrl.replace(/\/$/, '')}/api/v1/liveness`, {
      method: 'POST',
      body: formData,
      headers: authHeaders(),
    });
    if (!response.ok) {
      logger.warn(`Face service /liveness returned ${response.status}`);
      return null;
    }
    const data = (await response.json()) as { live?: boolean; yawRange?: number };
    return { live: !!data.live, yawRange: data.yawRange };
  } catch (error) {
    logger.error('Liveness check failed', error);
    return null;
  }
}

/** Cosine similarity of two vectors (SFace embeddings are already L2-normalized). */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
