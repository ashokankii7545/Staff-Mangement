import { env } from '../../config/env.js';
import { logger } from '../logger/logger.js';

/**
 * Calls the Python microservice to get a 512D face embedding from a base64 image.
 */
export async function getFaceEmbeddingFromBase64(base64Image: string): Promise<number[] | null> {
  if (!env.faceServiceUrl) {
    logger.warn('FACE_SERVICE_URL is not set. Skipping face embedding extraction.');
    return null;
  }

  try {
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const blob = new Blob([buffer], { type: 'image/jpeg' });

    const formData = new FormData();
    formData.append('file', blob, 'image.jpg');

    const response = await fetch(`${env.faceServiceUrl}/api/v1/embed`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      logger.error(`Face service returned ${response.status}: ${await response.text()}`);
      return null;
    }

    const data = (await response.json()) as { embedding: number[] };
    return data.embedding;
  } catch (error) {
    logger.error('Failed to extract face embedding:', error);
    return null;
  }
}

/**
 * Computes cosine similarity between two vectors.
 */
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
