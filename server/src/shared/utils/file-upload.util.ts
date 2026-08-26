import { ValidationError } from '../errors/app.errors.js';
import { uploadToR2 } from './r2.util.js';

const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3 MB decoded ceiling per image
const DATA_URI_RE = /^data:(image\/(jpeg|png|webp));base64,/;

const MAX_DOC_BYTES = 5 * 1024 * 1024; // 5 MB ceiling per document
const DOC_URI_RE = /^data:(image\/(jpeg|png|webp)|application\/pdf);base64,/;
const DOC_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

const DOC_MIME: Record<string, string> = {
  'image/jpeg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
  'application/pdf': 'application/pdf',
};

/**
 * Save a base64-encoded document (PDF or image) to Cloudflare R2.
 * Accepts ONLY application/pdf | image/jpeg | image/png | image/webp and
 * rejects empty / oversized (>5 MB decoded) uploads.
 * @returns Full public URL of the uploaded file
 */
export const saveBase64Document = async (base64Data: string, filename: string): Promise<string> => {
  if (typeof base64Data !== 'string' || base64Data.length < 42) {
    throw new ValidationError('Invalid document payload.');
  }

  const uriMatch = DOC_URI_RE.exec(base64Data.slice(0, 60));
  if (!uriMatch) throw new ValidationError('Only PDF, JPG, PNG or WebP files are allowed.');
  const mime = uriMatch[1];
  const b64 = base64Data.slice(uriMatch[0].length);
  const buffer = Buffer.from(b64, 'base64');

  if (!buffer.length) throw new ValidationError('Empty document payload.');
  if (buffer.length > MAX_DOC_BYTES) {
    throw new ValidationError('Document too large – maximum allowed size is 5 MB.');
  }

  const fullFilename = `${filename}.${DOC_EXT[mime]}`;
  const key = `documents/${fullFilename}`;

  return uploadToR2(buffer, key, DOC_MIME[mime]);
};

/**
 * Save a base64-encoded selfie/image to Cloudflare R2 (hardened):
 * accepts ONLY image/jpeg | image/png | image/webp payloads and rejects
 * empty / oversized (>3 MB decoded) uploads.
 * @returns Full public URL of the uploaded selfie
 */
export const saveBase64Image = async (base64Data: string, filename: string): Promise<string> => {
  if (typeof base64Data !== 'string' || base64Data.length < 42) {
    throw new ValidationError('Invalid image payload.');
  }

  const uriMatch = DATA_URI_RE.exec(base64Data.slice(0, 40));
  const b64 = uriMatch ? base64Data.slice(uriMatch[0].length) : base64Data;
  const buffer = Buffer.from(b64, 'base64');

  if (!buffer.length) throw new ValidationError('Empty image payload.');
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new ValidationError('Image too large – maximum allowed size is 3 MB.');
  }

  const fullFilename = `${filename}.jpg`;
  const key = `selfies/${fullFilename}`;

  return uploadToR2(buffer, key, 'image/jpeg');
};

const IMAGE_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const IMAGE_MIME: Record<string, string> = {
  'image/jpeg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
};

/**
 * Save a base64-encoded medicine photo to Cloudflare R2 (catalogue images):
 * accepts ONLY image/jpeg | image/png | image/webp payloads, rejects empty /
 * oversized (>3 MB decoded) uploads and preserves the real extension so the
 * correct content type is served.
 * @returns Full public URL of the uploaded file
 */
export const saveBase64MedicineImage = async (base64Data: string, filename: string): Promise<string> => {
  if (typeof base64Data !== 'string' || base64Data.length < 42) {
    throw new ValidationError('Invalid image payload.');
  }

  const uriMatch = DATA_URI_RE.exec(base64Data.slice(0, 60));
  if (!uriMatch) throw new ValidationError('Only JPG, PNG or WebP images are allowed.');
  const mime = uriMatch[1];
  const b64 = base64Data.slice(uriMatch[0].length);
  const buffer = Buffer.from(b64, 'base64');

  if (!buffer.length) throw new ValidationError('Empty image payload.');
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new ValidationError('Image too large – maximum allowed size is 3 MB.');
  }

  const targetExt = IMAGE_EXT[mime];
  const fullFilename = `${filename}.${targetExt}`;
  const key = `medicines/${fullFilename}`;

  return uploadToR2(buffer, key, IMAGE_MIME[mime]);
};
