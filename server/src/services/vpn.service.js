import { checkVPN, checkWebRTCMismatch, checkTimezoneMismatch } from '../utils/vpnDetector.js';

/**
 * Run all VPN detection layers and return comprehensive result
 */
export const runVPNCheck = async ({ ipAddress, webRTCIPs, browserTimezone }) => {
  const vpnResult = await checkVPN(ipAddress);
  const webrtcMismatch = checkWebRTCMismatch(ipAddress, webRTCIPs || []);
  const timezoneMismatch = checkTimezoneMismatch(browserTimezone, vpnResult.ipTimezone);
  
  return {
    vpn: vpnResult.vpn,
    proxy: vpnResult.proxy,
    tor: vpnResult.tor,
    relay: vpnResult.relay,
    webrtcMismatch,
    timezoneMismatch,
    isVPN: vpnResult.isVPN || webrtcMismatch,
    ipTimezone: vpnResult.ipTimezone,
  };
};
