import { useState, useRef, useEffect } from "react";
import type { FriendSearchResult } from "../../contacts/types";

export type UseNearbyStateDeps = {

};

export function useNearbyState({

}: UseNearbyStateDeps) {
  const [nearbyUsers, setNearbyUsers] = useState<FriendSearchResult[]>([]);
  const [nearbyBusy, setNearbyBusy] = useState(false);
  const [nearbyScanning, setNearbyScanning] = useState(false);
  const [nearbyUntil, setNearbyUntil] = useState(0);
  const [nearbyResultRadiusKm, setNearbyResultRadiusKm] = useState(5);
  const [nearbyRadiusKm, setNearbyRadiusKm] = useState(5);
  const nearbyRequest = useRef(0);
  useEffect(() => {
    if (!nearbyUntil) return;
    const timer = window.setTimeout(
      () => {
        // Keep the last scan results visible from the longer server-side cache.
        // Only the short "active nearby" lease expires here.
        setNearbyUntil(0);
      },
      Math.max(0, nearbyUntil - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [nearbyUntil]);

  return {
    nearbyBusy,
    nearbyRadiusKm,
    nearbyRequest,
    nearbyResultRadiusKm,
    nearbyScanning,
    nearbyUntil,
    nearbyUsers,
    setNearbyBusy,
    setNearbyRadiusKm,
    setNearbyResultRadiusKm,
    setNearbyScanning,
    setNearbyUntil,
    setNearbyUsers,
  };
}
