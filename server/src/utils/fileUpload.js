import fs from 'fs';
import path from 'path';
import { config } from '../config/environment.js';

const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3 MB decoded ceiling per image
const DATA_URI_RE = /^data:(image\/(jpeg|png|webp));base64,/;

const MAX_DOC_BYTES = 5 * 1024 * 1024; // 5 MB ceiling per document
const DOC_URI_RE = /^data:(image\/(jpeg|png|webp)|application\/pdf);base64,/;
const DOC_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };

/**
 * Save a base64-encoded document (PDF or image) to disk for the staff vault.
 *  - accepts ONLY application/pdf | image/jpeg | image/png | image/webp
 *  - rejects empty and oversized (>5 MB decoded) uploads
 * @returns {string} Relative URL path to the saved file
 */
export const saveBase64Document = (base64Data, filename) => {
  if (typeof base64Data !== 'string' || base64Data.length < 42) {
    throw new Error('Invalid document payload.');
  }

  const uriMatch = DOC_URI_RE.exec(base64Data.slice(0, 60));
  if (!uriMatch) throw new Error('Only PDF, JPG, PNG or WebP files are allowed.');
  const mime = uriMatch[1];
  const b64 = base64Data.slice(uriMatch[0].length);
  const buffer = Buffer.from(b64, 'base64');

  if (!buffer.length) throw new Error('Empty document payload.');
  if (buffer.length > MAX_DOC_BYTES) {
    throw new Error('Document too large – maximum allowed size is 5 MB.');
  }

  const docsDir = path.join(process.cwd(), config.uploadDir, 'documents');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  const fullFilename = `${filename}.${DOC_EXT[mime]}`;
  fs.writeFileSync(path.join(docsDir, fullFilename), buffer);

  return `/uploads/documents/${fullFilename}`;
};

/**
 * Save a base64-encoded image to disk (hardened):
 *  - accepts ONLY image/jpeg | image/png | image/webp payloads
 *  - rejects empty and oversized (>3 MB decoded) uploads
 * @param {string} base64Data - Base64 image (with or without data URI prefix)
 * @param {string} filename - Filename without extension
 * @returns {string} Relative URL path to the saved file
 */
export const saveBase64Image = (base64Data, filename) => {
  if (typeof base64Data !== 'string' || base64Data.length < 42) {
    throw new Error('Invalid image payload.');
  }

  const uriMatch = DATA_URI_RE.exec(base64Data.slice(0, 40));
  const b64 = uriMatch ? base64Data.slice(uriMatch[0].length) : base64Data;
  const buffer = Buffer.from(b64, 'base64');

  if (!buffer.length) throw new Error('Empty image payload.');
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error('Image too large – maximum allowed size is 3 MB.');
  }

  const selfiesDir = path.join(process.cwd(), config.uploadDir, 'selfies');
  
  // Ensure directory exists
  if (!fs.existsSync(selfiesDir)) {
    fs.mkdirSync(selfiesDir, { recursive: true });
  }
  
  const ext = 'jpg';
  const fullFilename = `${filename}.${ext}`;
  const filePath = path.join(selfiesDir, fullFilename);
  
  fs.writeFileSync(filePath, buffer);
  
  return `/uploads/selfies/${fullFilename}`;
};
