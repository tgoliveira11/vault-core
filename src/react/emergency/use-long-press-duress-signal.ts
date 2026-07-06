"use client";

import { useCallback, useRef, useState, type PointerEventHandler } from "react";
import { DEFAULT_DURESS_LONG_PRESS_MS } from "../../emergency/constants.js";

export type UseLongPressDuressSignalOptions = {
  thresholdMs?: number;
  disabled?: boolean;
};

export type UseLongPressDuressSignalResult = {
  duressSignaled: boolean;
  resetDuressSignal: () => void;
  onPointerDown: PointerEventHandler;
  onPointerUp: PointerEventHandler;
  onPointerLeave: PointerEventHandler;
  onPointerCancel: PointerEventHandler;
};

/**
 * Detects a long press (default ≥ 1000 ms) and latches {@link duressSignaled} until reset.
 */
export function useLongPressDuressSignal(
  options: UseLongPressDuressSignalOptions = {}
): UseLongPressDuressSignalResult {
  const thresholdMs = options.thresholdMs ?? DEFAULT_DURESS_LONG_PRESS_MS;
  const disabled = options.disabled ?? false;
  const [duressSignaled, setDuressSignaled] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetDuressSignal = useCallback(() => {
    setDuressSignaled(false);
    clearTimer();
    activeRef.current = false;
  }, [clearTimer]);

  const onPointerDown = useCallback<PointerEventHandler>(
    (event) => {
      if (disabled) return;
      if (event.button !== 0 && event.pointerType === "mouse") return;
      activeRef.current = true;
      clearTimer();
      timerRef.current = setTimeout(() => {
        if (activeRef.current) {
          setDuressSignaled(true);
        }
      }, thresholdMs);
    },
    [clearTimer, disabled, thresholdMs]
  );

  const cancelPress = useCallback(() => {
    activeRef.current = false;
    clearTimer();
  }, [clearTimer]);

  const onPointerUp = useCallback<PointerEventHandler>(() => {
    cancelPress();
  }, [cancelPress]);

  const onPointerLeave = useCallback<PointerEventHandler>(() => {
    cancelPress();
  }, [cancelPress]);

  const onPointerCancel = useCallback<PointerEventHandler>(() => {
    cancelPress();
  }, [cancelPress]);

  return {
    duressSignaled,
    resetDuressSignal,
    onPointerDown,
    onPointerUp,
    onPointerLeave,
    onPointerCancel,
  };
}
