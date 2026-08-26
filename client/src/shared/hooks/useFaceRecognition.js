import { useState, useEffect, useCallback } from 'react';
import * as faceapi from 'face-api.js';

const MATCH_THRESHOLD = 0.55; // Euclidean distance – lower = more similar

/** Resolve relative paths ('/uploads/..') against the current origin – the dev
 *  proxy (and production same-origin) serve them, Google avatars pass through */
const resolveImageUrl = (src) => {
  if (!src) return src;
  if (/^https?:\/\//i.test(src) || src.startsWith('data:')) return src;
  return `${window.location.origin}${src.startsWith('/') ? '' : '/'}${src}`;
};

export const useFaceRecognition = () => {
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loadingError, setLoadingError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const loadModels = async () => {
      try {
        // Absolute URL – survives proxies & sub-paths
        const MODEL_URL = `${window.location.origin}/models`;
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        if (mounted) setModelsLoaded(true);
      } catch (err) {
        console.error('Failed to load face-api models:', err);
        if (mounted) setLoadingError(err.message);
      }
    };
    loadModels();
    return () => { mounted = false; };
  }, []);

  /** Returns a 128-float descriptor, or null when no usable face is found */
  const getFaceDescriptor = async (imageSrc) => {
    if (!modelsLoaded) throw new Error('Face models are still loading');
    const img = await faceapi.fetchImage(resolveImageUrl(imageSrc));
    const detection = await faceapi
      .detectSingleFace(img)
      .withFaceLandmarks()
      .withFaceDescriptor();
    return detection ? detection.descriptor : null;
  };

  /**
   * verifyFace – compares the live punch selfie against the registered avatar.
   *
   * OUTCOME CONTRACT (AttendanceDialog + server flagging depend on this):
   *   MATCHED            distance < threshold            → clean punch
   *   MISMATCH           distance >= threshold           → punch recorded but FLAGGED
   *   NO_FACE_LIVE       no face found IN THE SELFIE     → BLOCK the punch
   *   AVATAR_UNREADABLE  no/unreadable reference photo   → punch recorded but FLAGGED
   *   ERROR              model/network failure           → punch recorded but FLAGGED
   * Fail-open-to-review beats locking genuine staff out on false positives.
   */
  const verifyFace = useCallback(async (capturedImageSrc, avatarUrl) => {
    const base = { threshold: MATCH_THRESHOLD };

    if (!avatarUrl) {
      return {
        ...base,
        outcome: 'AVATAR_UNREADABLE',
        match: false,
        error: 'No profile photo registered for this account.',
      };
    }

    try {
      const liveDescriptor = await getFaceDescriptor(capturedImageSrc);
      if (!liveDescriptor) {
        return {
          ...base,
          outcome: 'NO_FACE_LIVE',
          match: false,
          error: 'No face detected in the capture. Please retake with your face clearly visible.',
        };
      }

      const avatarDescriptor = await getFaceDescriptor(avatarUrl);
      if (!avatarDescriptor) {
        return {
          ...base,
          outcome: 'AVATAR_UNREADABLE',
          match: false,
          error: 'Could not detect a face in your registered profile photo. Ask an admin to update it.',
        };
      }

      const distance = faceapi.euclideanDistance(liveDescriptor, avatarDescriptor);
      const matched = distance < MATCH_THRESHOLD;
      return {
        ...base,
        outcome: matched ? 'MATCHED' : 'MISMATCH',
        match: matched,
        distance,
      };
    } catch (err) {
      console.error('Face verification failed:', err);
      return {
        ...base,
        outcome: 'ERROR',
        match: false,
        error: err?.message || 'Facial recognition error',
      };
    }
  }, [modelsLoaded]);

  return { modelsLoaded, loadingError, verifyFace };
};
