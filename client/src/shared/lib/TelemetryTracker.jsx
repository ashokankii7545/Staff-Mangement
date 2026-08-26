import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { logger } from './logger';

export const TelemetryTracker = () => {
  const location = useLocation();

  useEffect(() => {
    logger.addBreadcrumb(`Navigated to ${location.pathname}`);
  }, [location]);

  useEffect(() => {
    const handleClick = (e) => {
      // Find the closest button or a link
      const target = e.target.closest('button, a');
      if (target) {
        const action = target.innerText || target.getAttribute('aria-label') || target.tagName;
        logger.addBreadcrumb(`Clicked ${action}`);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return null;
};

