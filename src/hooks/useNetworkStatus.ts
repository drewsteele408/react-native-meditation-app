import { useEffect, useState } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

/**
 * NFR-04: surfaces "no network connection" instead of a spinner or silent
 * failure. Returns `true` only once NetInfo has positively confirmed there
 * is no connection (`isConnected === false`) — the initial/unknown state
 * (`isConnected === null`, before the first native callback fires) is
 * treated as online so the UI doesn't flash a false "offline" banner on
 * mount.
 */
export function useNetworkStatus(): boolean {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const handleChange = (state: NetInfoState) => {
      setIsOffline(state.isConnected === false);
    };

    // Prime the state immediately rather than waiting for the first event.
    NetInfo.fetch().then(handleChange);
    const unsubscribe = NetInfo.addEventListener(handleChange);

    return () => unsubscribe();
  }, []);

  return isOffline;
}
