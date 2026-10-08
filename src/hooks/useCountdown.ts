import { useState, useEffect, useRef, useCallback } from 'react';
import { Animated } from 'react-native';
import * as Haptics from 'expo-haptics';

interface UseCountdownReturn {
  secondsLeft: number;
  progress: Animated.Value;
  isExpired: boolean;
  cancel: () => void;
  start: () => void;
}

export function useCountdown(
  totalSeconds: number,
  onExpire: () => void,
): UseCountdownReturn {
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [isExpired, setIsExpired] = useState(false);
  const [running, setRunning] = useState(false);
  const progress = useRef(new Animated.Value(1)).current;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (animRef.current) {
      animRef.current.stop();
      animRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    setSecondsLeft(totalSeconds);
    setIsExpired(false);
    progress.setValue(1);
    setRunning(true);
  }, [totalSeconds, progress]);

  const cancel = useCallback(() => {
    clearTimer();
    setRunning(false);
    setIsExpired(false);
    setSecondsLeft(totalSeconds);
    progress.setValue(1);
  }, [clearTimer, totalSeconds, progress]);

  useEffect(() => {
    if (!running) return;

    // Animate progress bar from 1 → 0 over totalSeconds
    animRef.current = Animated.timing(progress, {
      toValue: 0,
      duration: totalSeconds * 1000,
      useNativeDriver: false,
    });
    animRef.current.start();

    // Haptic pulse every second
    intervalRef.current = setInterval(async () => {
      setSecondsLeft((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clearTimer();
          setIsExpired(true);
          setRunning(false);
          onExpireRef.current();
          return 0;
        }
        // Escalate haptic intensity as timer nears zero
        if (next <= 3) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        } else if (next <= 5) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
        return next;
      });
    }, 1000);

    return () => clearTimer();
  }, [running, totalSeconds, progress, clearTimer]);

  useEffect(() => {
    start();
    // Start on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { secondsLeft, progress, isExpired, cancel, start };
}
