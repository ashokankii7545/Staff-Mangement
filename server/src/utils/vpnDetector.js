import axios from 'axios';
import { config } from '../config/environment.js';

/**
 * Detect VPN/Proxy usage using vpnapi.io
 * @param {string} ipAddress - Client IP address
 * @returns {Promise<Object>} VPN detection results
 */
export const checkVPN = async (ipAddress) => {
  const result = {
    vpn: false,
    proxy: false,
    tor: false,
    relay: false,
    ipTimezone: null,
    isVPN: false,
  };

  // Skip VPN check for localhost/private IPs
  if (!ipAddress || ipAddress === '127.0.0.1' || ipAddress === '::1' || ipAddress.startsWith('192.168.') || ipAddress.startsWith('10.')) {
    return result;
  }

  if (!config.vpnapiKey) {
    console.warn('⚠️ VPNAPI_KEY not set, skipping VPN detection');
    return result;
  }

  try {
    const response = await axios.get(`https://vpnapi.io/api/${ipAddress}?key=${config.vpnapiKey}`, {
      timeout: 5000,
    });
    
    if (response.data && response.data.security) {
      result.vpn = response.data.security.vpn || false;
      result.proxy = response.data.security.proxy || false;
      result.tor = response.data.security.tor || false;
      result.relay = response.data.security.relay || false;
      result.isVPN = result.vpn || result.proxy || result.tor || result.relay;
    }
    
    if (response.data && response.data.location) {
      result.ipTimezone = response.data.location.timezone || null;
    }
  } catch (error) {
    console.error('VPN check API error:', error.message);
    // Don't block attendance on API failure
  }

  return result;
};

/**
 * Check WebRTC IP mismatch
 * @param {string} requestIP - The HTTP request IP
 * @param {string[]} webRTCIPs - IPs discovered via WebRTC on the client
 * @returns {boolean} True if mismatch detected (possible VPN)
 */
export const checkWebRTCMismatch = (requestIP, webRTCIPs) => {
  // Skip VPN check for localhost/private IPs
  if (!requestIP || requestIP === '127.0.0.1' || requestIP === '::1' || requestIP.startsWith('192.168.') || requestIP.startsWith('10.')) {
    return false;
  }

  if (!webRTCIPs || webRTCIPs.length === 0) return false;
  
  const privateRanges = ['192.168.', '10.', '172.16.', '172.17.', '172.18.', '172.19.',
    '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.',
    '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.', '0.0.0.0', '127.'];
  
  const publicWebRTCIPs = webRTCIPs.filter(ip => 
    !privateRanges.some(range => ip.startsWith(range))
  );
  
  // If WebRTC exposes a public IP different from request IP, VPN is likely
  return publicWebRTCIPs.length > 0 && !publicWebRTCIPs.includes(requestIP);
};

/**
 * Check timezone mismatch between browser and IP-based timezone
 * @param {string} browserTimezone - Browser's Intl.DateTimeFormat timezone
 * @param {string} ipTimezone - Timezone from IP geolocation
 * @returns {boolean} True if mismatch detected
 */
export const checkTimezoneMismatch = (browserTimezone, ipTimezone) => {
  if (!browserTimezone || !ipTimezone) return false;
  return browserTimezone !== ipTimezone;
};
