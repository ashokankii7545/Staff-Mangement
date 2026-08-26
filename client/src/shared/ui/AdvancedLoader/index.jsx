import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import Fade from '@mui/material/Fade';
import Backdrop from '@mui/material/Backdrop';
import { keyframes, useTheme, alpha } from '@mui/material/styles';

const bounceKeyframes = keyframes`
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1.0); }
`;

/**
 * AdvancedLoader – The single enterprise loading primitive for the whole app.
 *
 * Variants: 'gradient' | 'dots' | 'linear' | 'skeleton' | 'spinner'
 * Display modes: 'block' | 'inline' | 'overlay' | 'fullscreen'
 *
 * Smart defaults are theme-aware: the gradient uses palette.primary →
 * palette.secondary and all surfaces adapt to dark mode automatically.
 */
export const AdvancedLoader = React.memo(({
  isLoading = true,
  children,
  variant = 'gradient',
  displayMode = 'block',
  size = 40,
  message,
  delay = 250,
  skeletonHeight = 100,
  gradientStart,
  gradientEnd,
  transitionDuration = 300,
  sx,
}) => {
  const [show, setShow] = useState(false);
  const uniqueId = React.useId();
  const theme = useTheme();

  // Theme-aware brand colors (adapts to dark mode & rebrands)
  const startColor = gradientStart || theme.palette.primary.main;
  const endColor = gradientEnd || theme.palette.secondary.main;

  useEffect(() => {
    let timer;
    if (isLoading) {
      timer = setTimeout(() => setShow(true), Math.max(0, delay));
    } else {
      setShow(false);
    }
    return () => clearTimeout(timer);
  }, [isLoading, delay]);

  const renderGradientSpinner = () => {
    // Sanitize ID for SVG reference
    const gradientId = `gradient-${uniqueId.replace(/:/g, '')}`;
    return (
      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
        <svg width={0} height={0} style={{ position: 'absolute' }}>
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={startColor} />
              <stop offset="100%" stopColor={endColor} />
            </linearGradient>
          </defs>
        </svg>
        <CircularProgress
          size={size}
          sx={{
            '& .MuiCircularProgress-circle': {
              stroke: `url(#${gradientId})`,
            },
          }}
        />
      </Box>
    );
  };

  const renderDots = () => (
    <Box display="flex" gap={1} alignItems="center" justifyContent="center">
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          sx={{
            width: Math.max(8, Number(size) * 0.25),
            height: Math.max(8, Number(size) * 0.25),
            bgcolor: 'primary.main',
            borderRadius: '50%',
            animation: `${bounceKeyframes} 1.4s infinite ease-in-out both`,
            animationDelay: `${i * 0.16}s`,
          }}
        />
      ))}
    </Box>
  );

  const renderLinear = () => (
    <Box sx={{ width: '100%', maxWidth: 320 }}>
      <LinearProgress
        sx={{
          height: 6,
          borderRadius: 3,
          backgroundColor: (t) => alpha(t.palette.primary.main, 0.12),
          '& .MuiLinearProgress-bar': {
            borderRadius: 3,
            backgroundImage: `linear-gradient(90deg, ${startColor}, ${endColor})`,
          },
        }}
      />
    </Box>
  );

  const renderSkeleton = () => (
    <Skeleton
      variant="rounded"
      width="100%"
      height={skeletonHeight}
      animation="wave"
      aria-label="Loading skeleton"
    />
  );

  const getVisualSpinner = () => {
    if (variant === 'gradient') return renderGradientSpinner();
    if (variant === 'dots') return renderDots();
    if (variant === 'linear') return renderLinear();
    if (variant === 'skeleton') return renderSkeleton();
    return <CircularProgress size={size} color="primary" />;
  };

  const loaderContent = (
    <Box
      role={variant === 'skeleton' ? 'progressbar' : 'status'}
      aria-live="polite"
      aria-busy={show}
      sx={{
        display: displayMode === 'inline' ? 'inline-flex' : 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1.5,
        width: variant === 'skeleton' || variant === 'linear' ? '100%' : 'auto',
        ...sx,
      }}
    >
      {getVisualSpinner()}
      {message && variant !== 'skeleton' && (
        <Typography variant="body2" color="text.secondary" fontWeight={500}>
          {message}
        </Typography>
      )}
    </Box>
  );

  if (displayMode === 'fullscreen') {
    return (
      <React.Fragment>
        {children}
        <Backdrop
          open={show}
          sx={{
            color: '#fff',
            zIndex: (t) => t.zIndex.drawer + 2,
            flexDirection: 'column',
            gap: 2,
            backdropFilter: 'blur(4px)',
            bgcolor: (t) =>
              t.palette.mode === 'dark'
                ? alpha(t.palette.background.default, 0.7)
                : alpha(t.palette.background.paper, 0.75),
          }}
        >
          {getVisualSpinner()}
          {message && <Typography variant="h6">{message}</Typography>}
        </Backdrop>
      </React.Fragment>
    );
  }

  if (displayMode === 'overlay') {
    return (
      <Box sx={{ position: 'relative', width: '100%', height: '100%' }} aria-busy={show}>
        {children}
        <Fade in={show} timeout={transitionDuration} unmountOnExit>
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: (t) =>
                t.palette.mode === 'dark'
                  ? alpha(t.palette.background.default, 0.6)
                  : alpha(t.palette.background.paper, 0.72),
              zIndex: 2,
              backdropFilter: 'blur(2px)',
              borderRadius: 'inherit',
            }}
          >
            {loaderContent}
          </Box>
        </Fade>
      </Box>
    );
  }

  if (variant === 'skeleton' && children) {
    return (
      <React.Fragment>
        {show ? (
          <Fade in={show} timeout={transitionDuration} unmountOnExit>
            {loaderContent}
          </Fade>
        ) : (
          <Fade in={!show} timeout={transitionDuration}>
            <Box>{children}</Box>
          </Fade>
        )}
      </React.Fragment>
    );
  }

  return show ? (
    <Fade in={show} timeout={transitionDuration} unmountOnExit>
      {loaderContent}
    </Fade>
  ) : (
    <Fade in={!show} timeout={transitionDuration}>
      <Box>{children}</Box>
    </Fade>
  );
});

AdvancedLoader.displayName = 'AdvancedLoader';

AdvancedLoader.propTypes = {
  isLoading: PropTypes.bool,
  children: PropTypes.node,
  variant: PropTypes.oneOf(['spinner', 'gradient', 'dots', 'linear', 'skeleton']),
  displayMode: PropTypes.oneOf(['inline', 'block', 'overlay', 'fullscreen']),
  size: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  message: PropTypes.node,
  delay: PropTypes.number,
  skeletonHeight: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  /** Override brand gradient start (defaults to theme.palette.primary.main) */
  gradientStart: PropTypes.string,
  /** Override brand gradient end (defaults to theme.palette.secondary.main) */
  gradientEnd: PropTypes.string,
  transitionDuration: PropTypes.number,
  sx: PropTypes.object,
};

export default AdvancedLoader;

