import axios from 'axios';
import { env } from '../../config/env.js';
import { logger } from '../logger/logger.js';

/**
 * Extract a face embedding (descriptor vector) from a base64 image by calling
 * an optional external face-recognition service.
 *
 * When `FACE_SERVICE_URL` is not configured the feature is OFF: this returns
 * null and callers treat a missing embedding as non-fatal (the previous
 * behavior, since the env var was empty). When a service URL IS configured,
 * we POST the image and expect `{ embedding: number[] }` back.
 */
export const getFaceEmbeddingFromBase64 = async (
  base64: string,
): Promise<number[] | null> => {
  if (!env.faceServiceUrl) return null; // feature disabled
  try {
    const { data } = await axios.post<{ embedding?: number[] }>(
      `${env.faceServiceUrl.replace(/\/$/, '')}/embed`,
      { image: base64 },
      { timeout: 15_000 },
    );
    return Array.isArray(data?.embedding) && data.embedding.length ? data.embedding : null;
  } catch (error) {
    logger.error('Face embedding extraction failed', error);
    return null;
  }
};
