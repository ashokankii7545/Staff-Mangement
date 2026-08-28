/**
 * scanMedicineImage – client-side "document scanner" for medicine pack photos.
 *
 * Turns a casual snapshot into a clean, catalogue-ready product shot:
 *   1. Estimates the background colour from the image border pixels.
 *   2. Separates the subject (medicine pack) via colour-distance thresholding.
 *   3. Auto-crops to the subject's bounding box (with padding).
 *   4. Applies a "scanned document" enhancement: background flattened to pure
 *      white, contrast stretched on the subject.
 *   5. Downscales to MAX_DIMENSION and re-encodes as compact JPEG.
 *
 * Pure canvas maths – zero new dependencies. Falls back to the original image
 * (unchanged) whenever detection is inconclusive, so it can never "ruin" a
 * good photo.
 */

const MAX_DIMENSION = 1024; // keep well under the server's 3 MB ceiling
const BG_TOLERANCE = 60; // colour distance treated as "same as background"
const PAD_RATIO = 0.04; // 4% breathing room around the detected subject
const MIN_SUBJECT_RATIO = 0.12; // subject must fill ≥12% of frame to crop
const MAX_SUBJECT_RATIO = 0.985; // background barely detected → don't crop

const BG_TOL2 = BG_TOLERANCE * BG_TOLERANCE;

/** Load a data-url into an HTMLImageElement. */
const loadImage = (dataUrl) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image decode failed'));
    img.src = dataUrl;
  });

/** Median of a numeric array (robust against outlier border pixels). */
const median = (values) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

/** Squared Euclidean distance between two [r,g,b] triples. */
const dist2 = (a, b) => {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
};


/**
 * Scan a data-url image. Returns a processed JPEG data-url, or the original
 * input when the image cannot be decoded / has no clear subject.
 */
export const scanMedicineImage = async (dataUrl) => {
  let img;
  try {
    img = await loadImage(dataUrl);
  } catch {
    return dataUrl; // undecodable – hand back untouched
  }

  // ── Downscale first (cheaper pixel maths + guaranteed size ceiling) ──
  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);

  let pixels;
  try {
    pixels = ctx.getImageData(0, 0, w, h);
  } catch {
    return dataUrl; // tainted canvas (unlikely for data-urls) – bail out
  }
  const data = pixels.data;

  // ── 1. Estimate background colour from the border ring (median = robust) ──
  const rs = [];
  const gs = [];
  const bs = [];
  const border = Math.max(2, Math.round(Math.min(w, h) * 0.02));
  const sampleBorder = (x, y) => {
    const i = (y * w + x) * 4;
    rs.push(data[i]);
    gs.push(data[i + 1]);
    bs.push(data[i + 2]);
  };
  for (let x = 0; x < w; x += 2) {
    for (let b = 0; b < border; b += 1) {
      sampleBorder(x, b); // top
      sampleBorder(x, h - 1 - b); // bottom
    }
  }
  for (let y = 0; y < h; y += 2) {
    for (let b = 0; b < border; b += 1) {
      sampleBorder(b, y); // left
      sampleBorder(w - 1 - b, y); // right
    }
  }
  const bg = [median(rs), median(gs), median(bs)];

  // ── 2. Subject mask + bounding box (single pass) ──
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  let subjectCount = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      if (dist2([data[i], data[i + 1], data[i + 2]], bg) > BG_TOL2) {
        subjectCount += 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const subjectRatio = subjectCount / (w * h);
  const confident =
    maxX >= 0 && subjectRatio >= MIN_SUBJECT_RATIO && subjectRatio <= MAX_SUBJECT_RATIO;

  // ── 3. Crop to subject (padding clamped to frame) ──
  let sx = 0;
  let sy = 0;
  let sw = w;
  let sh = h;
  if (confident) {
    const padX = Math.round((maxX - minX) * PAD_RATIO);
    const padY = Math.round((maxY - minY) * PAD_RATIO);
    sx = Math.max(0, minX - padX);
    sy = Math.max(0, minY - padY);
    sw = Math.min(w - sx, maxX - minX + 1 + padX * 2);
    sh = Math.min(h - sy, maxY - minY + 1 + padY * 2);
  }

  // ── 4. "Scanned" enhancement on the (possibly cropped) region ──
  const out = document.createElement('canvas');
  out.width = sw;
  out.height = sh;
  const octx = out.getContext('2d', { willReadFrequently: true });
  if (!octx) return dataUrl;
  octx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

  let region;
  try {
    region = octx.getImageData(0, 0, sw, sh);
  } catch {
    return dataUrl;
  }
  const rd = region.data;

  // Contrast stretch: measure the subject's luminance range first.
  let lumMin = 255;
  let lumMax = 0;
  for (let i = 0; i < rd.length; i += 4) {
    if (dist2([rd[i], rd[i + 1], rd[i + 2]], bg) > BG_TOL2) {
      const lum = 0.299 * rd[i] + 0.587 * rd[i + 1] + 0.114 * rd[i + 2];
      if (lum < lumMin) lumMin = lum;
      if (lum > lumMax) lumMax = lum;
    }
  }
  const range = Math.max(1, lumMax - lumMin);

  for (let i = 0; i < rd.length; i += 4) {
    const px = [rd[i], rd[i + 1], rd[i + 2]];
    if (dist2(px, bg) <= BG_TOL2) {
      // Background → pure white (the "flatbed scanner" look).
      rd[i] = 255;
      rd[i + 1] = 255;
      rd[i + 2] = 255;
    } else {
      // Subject → stretch contrast around the measured range + mild lift.
      for (let c = 0; c < 3; c += 1) {
        const stretched = ((rd[i + c] - lumMin) / range) * 235 + 20;
        rd[i + c] = Math.max(0, Math.min(255, Math.round(stretched)));
      }
    }
    rd[i + 3] = 255; // fully opaque
  }
  octx.putImageData(region, 0, 0);

  // Return as JPEG (compact) – the 3 MB ceiling stays comfortably met.
  return out.toDataURL('image/jpeg', 0.85);
};

export default scanMedicineImage;
