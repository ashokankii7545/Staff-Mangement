import AppButton from '../../../shared/ui/AppButton';
import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import CameraswitchIcon from '@mui/icons-material/Cameraswitch';
import PhotoLibraryOutlinedIcon from '@mui/icons-material/PhotoLibraryOutlined';
import * as faceapi from 'face-api.js';
import {useEffect} from 'react';
const videoConstraints = {
  width: 480,
  height: 480,
  facingMode: 'user',
};

// Head-turn liveness burst. Two guided phases (turn LEFT, then RIGHT), each
// lasting PHASE_MS with a frame sampled every SAMPLE_MS. Liveness frames are
// downscaled (yaw detection needs little detail) to keep the request small;
// the final selfie is captured at full resolution separately.
const PHASE_MS = 1600; // time given for each turn direction
const SAMPLE_MS = 250; // gap between sampled liveness frames
const LIVENESS_FRAME_SIZE = 240; // px, small = light payload

const SelfieCapture = ({ onCapture, isPunching = false, buttonText = 'Take Photo & Punch Now', allowUpload = true, requireCenteredFace = false, requireLiveness = false }) => {
  const webcamRef = useRef(null);
  const fileInputRef = useRef(null);
  const [facingMode, setFacingMode] = useState('user');
  const [capturedImage, setCapturedImage] = useState(null);
  // Head-turn burst UI state: null = idle, else a countdown/prompt string.
  const [burstPrompt, setBurstPrompt] = useState(null);
  const capturingRef = useRef(false);

  // ── LIVE FACE-CENTERING GUIDANCE ──────────────────────────────────────────
  // TinyFaceDetector (~190 KB, separate from the heavy punch-time models)
  // samples the video every 700 ms purely for UX feedback. It NEVER blocks a
  // capture – if models fail to load we fall back to the static oval guide.
  const [faceStatus, setFaceStatus] = useState('INIT'); // INIT|NO_FACE|OFFCENTER|SIZE|READY|UNAVAILABLE

  useEffect(() => {
    let cancelled = false;
    let detectorReady = false;

    const loadModel = async () => {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri(`${window.location.origin}/models`);
        if (!cancelled) {
          detectorReady = true;
          setFaceStatus('NO_FACE');
        }
      } catch {
        if (!cancelled) setFaceStatus('UNAVAILABLE'); // static guide fallback
      }
    };

    const analyse = async () => {
      const video = webcamRef.current?.video;
      // Wait until video has loaded enough data AND has non-zero dimensions
      if (!video || video.readyState < 3 || video.videoWidth === 0 || video.videoHeight === 0) return;
      try {
        // Lowered threshold to 0.3 (more forgiving in low light)
        const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.3 });
        const det = await faceapi.detectSingleFace(video, options);
        if (cancelled) return;
        if (!det) {
          setFaceStatus('NO_FACE');
          return;
        }

        const box = det.box;
        const frameW = video.videoWidth || 1;
        const frameH = video.videoHeight || 1;
        const dx = Math.abs(box.x + box.width / 2 - frameW / 2) / frameW;
        const dy = Math.abs(box.y + box.height / 2 - frameH / 2) / frameH;
        const sizeRatio = box.height / frameH;

        // Extremely strict centering so face must be PERFECTLY in the middle
        if (sizeRatio < 0.35 || sizeRatio > 0.85) setFaceStatus('SIZE');
        else if (dx > 0.08 || dy > 0.10) setFaceStatus('OFFCENTER');
        else setFaceStatus('READY');
      } catch (err) {
        console.error("Face detector error:", err);
        // Fallback to allow capture if the detector crashes internally
        setFaceStatus('READY');
      }
    };

    loadModel();
    const timer = setInterval(() => {
      if (detectorReady && !capturedImage) analyse();
    }, 700);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [capturedImage]);

  // SAFEGUARD: if the tiny-face-detector or the camera never becomes ready the
  // faceStatus can sit on 'INIT' forever, which permanently disables the punch
  // button (a real edge case when /models is slow/blocked or the camera emits no
  // video while the browser is waiting for permission). After a short grace
  // period we fall back to 'UNAVAILABLE' (non-blocking) so a punch can ALWAYS be
  // submitted instead of silently never firing.
  useEffect(() => {
    const t = setTimeout(() => {
      setFaceStatus((prev) => (prev === 'INIT' ? 'UNAVAILABLE' : prev));
    }, 6000); // 6s grace – plenty for models + camera warm-up
    return () => clearTimeout(t);
  }, [capturedImage]);

  // Face gate – when required, CAPTURE stays disabled until the live detector
  // confirms a properly centered face. "UNAVAILABLE" (model failed to load)
  // never blocks anyone; INIT stays locked only while models are resolving.
  const faceGateBlocking =
    requireCenteredFace && ['INIT', 'NO_FACE', 'OFFCENTER', 'SIZE'].includes(faceStatus);

  const snap = (size = 640) => webcamRef.current?.getScreenshot({ width: size, height: size }) || null;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /** Sample small liveness frames for `ms` while showing `prompt`. */
  const samplePhase = async (prompt, ms, frames) => {
    const ticks = Math.max(1, Math.round(ms / SAMPLE_MS));
    for (let i = 0; i < ticks; i++) {
      const secsLeft = Math.ceil(((ticks - i) * SAMPLE_MS) / 1000);
      setBurstPrompt(`${prompt}  (${secsLeft}s)`);
      const f = snap(LIVENESS_FRAME_SIZE);
      if (f) frames.push(f);
      // eslint-disable-next-line no-await-in-loop
      await wait(SAMPLE_MS);
    }
  };

  /**
   * Capture path.
   *  - requireLiveness OFF: single screenshot (unchanged behavior).
   *  - requireLiveness ON: guided HEAD-TURN — a short "get ready", then TURN
   *    LEFT for PHASE_MS, then TURN RIGHT for PHASE_MS, sampling small frames
   *    throughout. The server confirms liveness from the head-yaw motion.
   *    Finally a full-res selfie is taken. onCapture(selfie, frames).
   */
  const capture = useCallback(async () => {
    if (!webcamRef.current || capturingRef.current) return;

    if (!requireLiveness) {
      const imageSrc = snap();
      setCapturedImage(imageSrc);
      onCapture(imageSrc);
      return;
    }

    capturingRef.current = true;
    const frames = [];
    try {
      setBurstPrompt('Get ready — you will turn your head');
      await wait(700);
      await samplePhase('↩️ Slowly turn your head to the LEFT', PHASE_MS, frames);
      await samplePhase('↪️ Now slowly turn to the RIGHT', PHASE_MS, frames);
      setBurstPrompt('✓ Look straight — capturing');
      await wait(400);
      const selfie = snap(640); // full-res selfie for identity match
      setCapturedImage(selfie);
      onCapture(selfie, frames);
    } finally {
      capturingRef.current = false;
      setBurstPrompt(null);
    }
  }, [onCapture, requireLiveness]);

  // AUTO-CAPTURE LOGIC (DISABLED BY USER REQUEST)
  const [autoCaptureTimer, setAutoCaptureTimer] = useState(null);
  
  useEffect(() => {
    // Disabled auto-capture completely
    setAutoCaptureTimer(null);
  }, [faceStatus, capturedImage, isPunching, requireCenteredFace, capture]);

  /** Gallery / file-picker path – same data-url pipeline as the camera */
  const handleFileUpload = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      setCapturedImage(dataUrl);
      onCapture(dataUrl);
    };
    reader.readAsDataURL(file);
    event.target.value = ''; // allow re-selecting the same file later
  }, [onCapture]);

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  return (
    <Stack alignItems="center" spacing={1.5} sx={{ width: '100%' }}>
      <Paper
        elevation={0}
        sx={{
          position: 'relative',
          width: '100%',
          maxWidth: 280,
          aspectRatio: '1',
          borderRadius: 3,
          overflow: 'hidden',
          bgcolor: 'text.primary',
          border: '2px solid', borderColor: 'divider',
        }}
      >
        <Webcam
          audio={false}
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          videoConstraints={{ ...videoConstraints, facingMode }}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        
        <Box sx={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 1 }}>
          <IconButton
            size="small"
            onClick={toggleCamera}
            sx={{ bgcolor: 'rgba(0,0,0,0.5)', color: 'white', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' } }}
          >
            <CameraswitchIcon fontSize="small" />
          </IconButton>
        </Box>
        
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '65%',
            height: '75%',
            border: '3px dashed',
            borderColor: faceStatus === 'READY' ? '#7CFC9B' : 'rgba(255,255,255,0.65)',
            borderRadius: '40%',
            pointerEvents: 'none',
            boxShadow: faceStatus === 'READY' ? '0 0 26px rgba(76,175,80,0.6)' : 'none',
            transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
          }}
        />
      </Paper>

      {burstPrompt && (
        <Typography
          variant="caption"
          sx={{ color: 'warning.main', textAlign: 'center', fontSize: '0.85rem', fontWeight: 700 }}
        >
          {burstPrompt}
        </Typography>
      )}

      <Typography
        variant="caption"
        sx={{
          color: faceStatus === 'READY' ? 'success.main' : 'text.secondary',
          textAlign: 'center',
          fontSize: '0.75rem',
          fontWeight: faceStatus === 'READY' ? 700 : 400,
        }}
      >
        {faceStatus === 'READY'
          ? (autoCaptureTimer !== null ? `✓ Face centered – Auto-capturing in ${autoCaptureTimer}...` : '✓ Face perfectly centered – capture now')
          : faceStatus === 'SIZE'
            ? 'Adjust your distance from the camera'
            : faceStatus === 'OFFCENTER' || faceStatus === 'NO_FACE'
              ? 'Center your face inside the circle'
              : faceStatus === 'UNAVAILABLE'
                ? (isPunching ? 'Look at the camera & click below for instant punch' : 'Look at the camera & click below to capture')
                : 'Preparing live face guide…'}
      </Typography>

      <Stack direction="row" spacing={1} sx={{ width: '100%' }}>
        <AppButton
          fullWidth
          onClick={capture}
          variant="contained"
          disabled={isPunching || faceGateBlocking || !!burstPrompt}
          title={faceGateBlocking ? 'Center your face inside the circle first' : undefined}
          sx={{
            bgcolor: faceGateBlocking ? 'action.disabledBackground' : 'success.main',
            color: 'background.paper',
            fontWeight: 700,
            py: 1.2,
            fontSize: '0.9375rem',
            borderRadius: 2,
            '&:hover': { bgcolor: faceGateBlocking ? 'action.disabledBackground' : 'success.dark' },
          }}
        >
          <CameraAltIcon sx={{ fontSize: 18, mr: 1, verticalAlign: 'text-bottom' }} />
          {burstPrompt ? 'Capturing…' : buttonText}
        </AppButton>

        {allowUpload && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            <AppButton
              variant="outlined"
              onClick={() => fileInputRef.current?.click()}
              disabled={isPunching}
              title="Upload a photo instead of using the camera"
              sx={{ minWidth: 0, px: 1.5, borderRadius: 2 }}
            >
              <PhotoLibraryOutlinedIcon fontSize="small" />
            </AppButton>
          </>
        )}
      </Stack>
    </Stack>
  );
};

export default SelfieCapture;
