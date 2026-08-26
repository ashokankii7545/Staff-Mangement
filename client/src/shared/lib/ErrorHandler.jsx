import React, { useEffect } from 'react';
import { ErrorBoundary, useErrorBoundary } from 'react-error-boundary';
import { Box, Typography, Button, Paper } from '@mui/material';
import { alpha } from '@mui/material/styles';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import { logger } from './logger'; // Integrated Enterprise Logger

// =====================================================================
// MODULE 2: UI LAYER (Custom Fallback Pages)
// =====================================================================
export const FullPageFallback = ({ error, resetErrorBoundary }) => {
  const isOffline = error?.message?.includes('Internet Connection') || !navigator.onLine;

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      bgcolor="background.default" // theme-aware (was hardcoded light grey – broke dark mode)
      color="text.primary"
      p={3}
    >
      {isOffline ? (
        <WifiOffIcon color="warning" sx={{ fontSize: 80, mb: 2 }} />
      ) : (
        <ErrorOutlineIcon color="error" sx={{ fontSize: 80, mb: 2 }} />
      )}
      
      <Typography variant="h4" fontWeight="bold" gutterBottom textAlign="center">
        {isOffline ? 'You are Offline' : 'System Crash (500)'}
      </Typography>
      
      <Typography variant="body1" color="textSecondary" mb={3} textAlign="center">
        {isOffline ? 'Please connect to the internet and try again.' : 'Something went critically wrong. Our team has been notified.'}
      </Typography>
      
      {!isOffline && (
        <Paper
          sx={(theme) => ({
            p: 2,
            bgcolor: alpha(theme.palette.error.main, 0.06),
            color: 'error.main',
            border: `1px solid ${alpha(theme.palette.error.main, 0.25)}`,
            maxWidth: 800,
            width: '100%',
            overflowX: 'auto',
            mb: 4,
          })}
        >
          <code style={{ whiteSpace: 'pre-wrap' }}>
            {error?.message || JSON.stringify(error)}{'\n\n'}{error?.stack}
          </code>
        </Paper>
      )}
      
      <Button variant="contained" size="large" onClick={resetErrorBoundary}>
        {isOffline ? 'Retry Connection' : 'Reload Application'}
      </Button>
    </Box>
  );
};

export const ComponentFallback = ({ error, resetErrorBoundary }) => (
  <Box
    p={2}
    sx={(theme) => ({
      border: `1px dashed ${alpha(theme.palette.error.main, 0.45)}`, // theme-aware
      borderRadius: 2,
      bgcolor: alpha(theme.palette.error.main, 0.04),
      textAlign: 'center',
      width: '100%',
    })}
  >
    <Typography color="error" fontWeight="bold" variant="subtitle2">
      ⚠️ Failed to load section
    </Typography>
    <Typography variant="caption" display="block" color="text.secondary" mb={1}>
      {error?.message || 'Component crashed.'}
    </Typography>
    <Button size="small" variant="outlined" color="error" onClick={resetErrorBoundary}>
      Retry
    </Button>
  </Box>
);

// =====================================================================
// MODULE 3: SYSTEM LAYER (Global Background Listener)
// =====================================================================
const GlobalErrorListener = ({ children }) => {
  // We intentionally removed the window 'error' and 'unhandledrejection' listeners here.
  // React Error Boundary automatically catches rendering errors.
  // Crashing the entire app for background network errors or third-party script errors is disruptive.
  return children;
};

// =====================================================================
// MODULE 4: THE MASTER WRAPPER (With Nightmare Protections)
// =====================================================================
let errorCount = 0;
let lastErrorTime = Date.now();

export const AppErrorBoundary = ({ 
  children, 
  variant = 'full', // 'full' or 'component'
  onReset 
}) => {
  const Fallback = variant === 'full' ? FullPageFallback : ComponentFallback;

  const handleReset = () => {
    if (onReset) {
      onReset();
    } else {
      // Nightmare Case Fix: Poisoned Cache Cleaning
      if (variant === 'full') {
        logger.warn("Full crash detected. Clearing session to prevent infinite loops.");
        sessionStorage.clear();
      }
      window.location.reload(); 
    }
  };

  const logErrorToService = (error, info) => {
    const errorMsg = error?.message || "";

    // Nightmare Case Fix: Hydration Mismatch (Silent Reload)
    if (
      errorMsg.includes("Hydration failed") || 
      errorMsg.includes("Text content did not match server-rendered HTML")
    ) {
      logger.warn("Hydration mismatch. Force reloading silently.");
      window.location.reload();
      return; 
    }

    // Nightmare Case Fix: Cloud Logging Rate Limiter (Max 5 errors/min)
    const currentTime = Date.now();
    if (currentTime - lastErrorTime > 60000) {
      errorCount = 0; 
      lastErrorTime = currentTime;
    }
    
    errorCount++;

    if (errorCount <= 5) {
      logger.fatal("React Error Boundary Caught Issue", { error: { message: errorMsg, stack: error?.stack }, info });
    } else {
      console.warn("🛑 [Rate Limited]: Too many errors. Log blocked to save billing.");
    }
  };

  return (
    <ErrorBoundary 
      FallbackComponent={Fallback} 
      onReset={handleReset}
      onError={logErrorToService}
    >
      {variant === 'full' ? (
        <GlobalErrorListener>
          {children}
        </GlobalErrorListener>
      ) : (
        children
      )}
    </ErrorBoundary>
  );
};

// =====================================================================
// MODULE 5: THE MAGIC HOOK
// =====================================================================
export const useAppError = () => {
  const { showBoundary } = useErrorBoundary();
  return showBoundary; 
};

