import { useNetwork } from 'ahooks';

/**
 * useOnlineStatus - Reactive browser online/offline state.
 *
 * Implemented on top of `ahooks` `useNetwork`.
 *
 * @returns {boolean} true when the browser is online
 */
export const useOnlineStatus = () => {
  const network = useNetwork();
  return network?.online ?? true;
};

export default useOnlineStatus;
