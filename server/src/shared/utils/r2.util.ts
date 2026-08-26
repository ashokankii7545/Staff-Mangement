import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../../config/env.js';
import { logger } from '../logger/logger.js';

/**
 * ────────────────────────────────────────────────────────────────────────────
 * CLOUDFLARE R2 CLIENT – Singleton S3-compatible object storage
 * ────────────────────────────────────────────────────────────────────────────
 * Uses the AWS SDK v3 S3Client pointed at the R2 endpoint.
 * All uploads return a public URL via the configured R2_PUBLIC_URL.
 */

let r2Client: S3Client | null = null;

/** Lazy-init so the app doesn't crash if R2 env vars are missing in dev. */
const getClient = (): S3Client => {
  if (!r2Client) {
    r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${env.r2.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.r2.accessKeyId,
        secretAccessKey: env.r2.secretAccessKey,
      },
    });
  }
  return r2Client;
};

/**
 * Upload a Buffer to R2 and return the public URL.
 * @param buffer  - The file content as a Buffer
 * @param key     - The object key (path inside the bucket), e.g. `selfies/abc_123.jpg`
 * @param contentType - MIME type, e.g. `image/jpeg`
 * @returns Full public URL to access the uploaded object
 */
export const uploadToR2 = async (
  buffer: Buffer,
  key: string,
  contentType: string,
): Promise<string> => {
  const client = getClient();

  await client.send(
    new PutObjectCommand({
      Bucket: env.r2.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );

  const publicUrl = `${env.r2.publicUrl}/${key}`;
  logger.debug(`[R2] Uploaded: ${publicUrl}`);
  return publicUrl;
};
