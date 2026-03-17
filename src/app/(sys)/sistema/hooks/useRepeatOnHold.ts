"use client";

import { useCallback, useRef } from "react";

const INITIAL_DELAY_MS = 400;
const INITIAL_INTERVAL_MS = 120;
const MIN_INTERVAL_MS = 40;
const ACCELERATION = 0.92;

/**
 * Hook for "press and hold" on +/− buttons: first tap fires once, then after a short delay
 * repeats the callback with increasing speed (shorter interval over time).
 */
export function useRepeatOnHold(callback: () => void) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const onPointerDown = useCallback(() => {
    clear();
    const cb = () => callbackRef.current();
    cb();

    timeoutRef.current = setTimeout(() => {
      let intervalMs = INITIAL_INTERVAL_MS;

      const schedule = () => {
        timeoutRef.current = setTimeout(() => {
          cb();
          intervalMs = Math.max(MIN_INTERVAL_MS, intervalMs * ACCELERATION);
          schedule();
        }, intervalMs);
      };
      schedule();
    }, INITIAL_DELAY_MS);
  }, [clear]);

  const onPointerUp = useCallback(() => clear(), [clear]);
  const onPointerLeave = useCallback(() => clear(), [clear]);
  const onPointerCancel = useCallback(() => clear(), [clear]);

  return { onPointerDown, onPointerUp, onPointerLeave, onPointerCancel };
}
