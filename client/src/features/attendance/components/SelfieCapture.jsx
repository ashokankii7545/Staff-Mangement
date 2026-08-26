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
import FlashOnIcon from '@mui/icons-material/FlashOn';
import PhotoLibraryOutlinedIcon from '@mui/icons-material/PhotoLibraryOutlined';
import * as faceapi from 'face-api.js';
import {useEffect} from 'react';
const videoConstraints = {
  width: 480,
  height: 480,
  facingMode: 'user',
};

const SelfieCapture = ({ onCapture, isPunching = false, buttonText = 'Take Photo & Punch Now', allowUpload = true, requireCenteredFace = false }) => {
  const webcamRef = useRef(null);
  const fileInputRef = useRef(null);
  const [facingMode, setFacingMode] = useState('user');
  const [capturedImage, setCapturedImage] = useState(null);

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

        // Significantly relaxed strictness so user doesn't get stuck
        if (sizeRatio < 0.15 || sizeRatio > 0.95) setFaceStatus('SIZE');
        else if (dx > 0.30 || dy > 0.35) setFaceStatus('OFFCENTER');
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

  // Face gate – when required, CAPTURE stays disabled until the live detector
  // confirms a properly centered face. "UNAVAILABLE" (model failed to load)
  // never blocks anyone; INIT stays locked only while models are resolving.
  const faceGateBlocking =
    requireCenteredFace && ['INIT', 'NO_FACE', 'OFFCENTER', 'SIZE'].includes(faceStatus);

  const capture = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot({ width: 640, height: 640 });
      setCapturedImage(imageSrc);
      onCapture(imageSrc);
    }
  }, [onCapture]);

  // AUTO-CAPTURE LOGIC
  const [autoCaptureTimer, setAutoCaptureTimer] = useState(null);
  
  useEffect(() => {
    let timerId;
    if (faceStatus === 'READY' && !capturedImage && !isPunching && requireCenteredFace) {
      // Start a 1.5-second countdown to auto-capture
      if (autoCaptureTimer === null) {
        setAutoCaptureTimer(2);
      } else if (autoCaptureTimer > 0) {
        timerId = setTimeout(() => setAutoCaptureTimer((prev) => prev - 1), 700);
      } else if (autoCaptureTimer === 0) {
        capture();
      }
    } else {
      setAutoCaptureTimer(null);
    }
    return () => clearTimeout(timerId);
  }, [faceStatus, autoCaptureTimer, capturedImage, isPunching, requireCenteredFace, capture]);

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
          disabled={isPunching || faceGateBlocking}
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
          {buttonText}
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
