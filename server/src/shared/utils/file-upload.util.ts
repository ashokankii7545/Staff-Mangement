import fs from 'fs';
import path from 'path';
import { ValidationError } from '../errors/app.errors.js';
import { env } from '../../config/env.js';

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

/**
 * Save a base64-encoded document (PDF or image) to disk for the staff vault.
 * Accepts ONLY application/pdf | image/jpeg | image/png | image/webp and
 * rejects empty / oversized (>5 MB decoded) uploads.
 * @returns Relative URL path to the saved file
 */
export const saveBase64Document = (base64Data: string, filename: string): string => {
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

  const docsDir = path.join(process.cwd(), env.uploadDir, 'documents');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  const fullFilename = `${filename}.${DOC_EXT[mime]}`;
  fs.writeFileSync(path.join(docsDir, fullFilename), buffer);

  return `/uploads/documents/${fullFilename}`;
};

/**
 * Save a base64-encoded selfie/image to disk (hardened):
 * accepts ONLY image/jpeg | image/png | image/webp payloads and rejects
 * empty / oversized (>3 MB decoded) uploads.
 */
export const saveBase64Image = (base64Data: string, filename: string): string => {
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

  const selfiesDir = path.join(process.cwd(), env.uploadDir, 'selfies');
  if (!fs.existsSync(selfiesDir)) {
    fs.mkdirSync(selfiesDir, { recursive: true });
  }

  const fullFilename = `${filename}.jpg`;
  fs.writeFileSync(path.join(selfiesDir, fullFilename), buffer);

  return `/uploads/selfies/${fullFilename}`;
};

const IMAGE_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Save a base64-encoded medicine photo to disk (catalogue images):
 * accepts ONLY image/jpeg | image/png | image/webp payloads, rejects empty /
 * oversized (>3 MB decoded) uploads and preserves the real extension so the
 * static server sends the correct content type.
 * @returns Relative URL path to the saved file
 */
export const saveBase64MedicineImage = (base64Data: string, filename: string): string => {
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

  const medicinesDir = path.join(process.cwd(), env.uploadDir, 'medicines');
  if (!fs.existsSync(medicinesDir)) {
    fs.mkdirSync(medicinesDir, { recursive: true });
  }

  // One stable filename per medicine id – re-uploads overwrite instead of
  // piling up orphaned files (stale extension variants are cleaned below).
  const targetExt = IMAGE_EXT[mime];
  for (const ext of Object.values(IMAGE_EXT)) {
    const stalePath = path.join(medicinesDir, `${filename}.${ext}`);
    if (ext !== targetExt && fs.existsSync(stalePath)) fs.unlinkSync(stalePath);
  }

  const fullFilename = `${filename}.${targetExt}`;
  fs.writeFileSync(path.join(medicinesDir, fullFilename), buffer);

  return `/uploads/medicines/${fullFilename}`;
};
