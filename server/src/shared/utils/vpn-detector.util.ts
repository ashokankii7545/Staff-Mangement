import axios from 'axios';
import { env } from '../../config/env.js';
import { logger } from '../logger/logger.js';

export interface VpnCheckResult {
  vpn: boolean;
  proxy: boolean;
  tor: boolean;
  relay: boolean;
  ipTimezone: string | null;
  isVPN: boolean;
}

const isPrivateIp = (ip?: string | null): boolean =>
  !ip ||
  ip === '127.0.0.1' ||
  ip === '::1' ||
  ip.startsWith('192.168.') ||
  ip.startsWith('10.') ||
  ip.startsWith('172.16.') ||
  ip.startsWith('172.17.') ||
  ip.startsWith('172.18.') ||
  ip.startsWith('172.19.') ||
  ip.startsWith('172.2') ||
  ip.startsWith('172.30.') ||
  ip.startsWith('172.31.');

/** Detect VPN/Proxy/Tor/Relay usage via vpnapi.io (fail-open on API errors). */
export const checkVPN = async (ipAddress: string | null | undefined): Promise<VpnCheckResult> => {
  const result: VpnCheckResult = {
    vpn: false,
    proxy: false,
    tor: false,
    relay: false,
    ipTimezone: null,
    isVPN: false,
  };

  if (isPrivateIp(ipAddress)) return result;

  if (!env.vpnApiKey) {
    logger.warn('VPNAPI_KEY not set – skipping VPN detection');
    return result;
  }

  try {
    const response = await axios.get(`https://vpnapi.io/api/${ipAddress}?key=${env.vpnApiKey}`, {
      timeout: 5000,
    });

    if (response.data?.security) {
      result.vpn = response.data.security.vpn || false;
      result.proxy = response.data.security.proxy || false;
      result.tor = response.data.security.tor || false;
      result.relay = response.data.security.relay || false;
      result.isVPN = result.vpn || result.proxy || result.tor || result.relay;
    }
    if (response.data?.location) {
      result.ipTimezone = response.data.location.timezone || null;
    }
  } catch (error) {
    // Never block attendance because the detection API hiccuped.
    logger.error('VPN check API error', error);
  }

  return result;
};

/**
 * WebRTC leak check – if the browser's STUN discovery exposes a public IP
 * different from the request IP, a VPN is likely in play.
 */
export const checkWebRTCMismatch = (
  requestIP: string | null | undefined,
  webRTCIPs: string[] | undefined,
): boolean => {
  if (isPrivateIp(requestIP)) return false;
  if (!webRTCIPs || webRTCIPs.length === 0) return false;

  const privateRanges = [
    '192.168.', '10.', '172.16.', '172.17.', '172.18.', '172.19.',
    '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.',
    '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.',
    '0.0.0.0', '127.',
  ];

  const publicWebRTCIPs = webRTCIPs.filter(
    (ip) => !privateRanges.some((range) => ip.startsWith(range)),
  );

  return publicWebRTCIPs.length > 0 && !publicWebRTCIPs.includes(requestIP as string);
};

/** Browser timezone vs IP-geolocation timezone disagreement. */
export const checkTimezoneMismatch = (
  browserTimezone?: string | null,
  ipTimezone?: string | null,
): boolean => {
  if (!browserTimezone || !ipTimezone) return false;
  return browserTimezone !== ipTimezone;
};
