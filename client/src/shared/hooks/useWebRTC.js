/**
 * Discovers public and local IPs via WebRTC ICE gathering
 * Used for VPN detection (comparing WebRTC IPs with HTTP request IP)
 */
export const getWebRTCIPs = () => {
  return new Promise((resolve) => {
    const discoveredIPs = new Set();
    
    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });

      pc.createDataChannel('');
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .catch(() => resolve([]));

      pc.onicecandidate = (event) => {
        if (!event || !event.candidate || !event.candidate.candidate) {
          resolve(Array.from(discoveredIPs));
          return;
        }

        const candidateStr = event.candidate.candidate;
        const ipMatch = candidateStr.match(/([0-9]{1,3}(\.[0-9]{1,3}){3})/);
        if (ipMatch) {
          discoveredIPs.add(ipMatch[1]);
        }
      };

      // Timeout fallback
      setTimeout(() => {
        pc.close();
        resolve(Array.from(discoveredIPs));
      }, 3000);
    } catch {
      resolve([]);
    }
  });
};

