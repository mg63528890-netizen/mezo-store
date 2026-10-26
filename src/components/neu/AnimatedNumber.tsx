import React, { useEffect, useState, useRef } from 'react';
import { Text, TextStyle, StyleProp, StyleSheet } from 'react-native';
import { formatNumber } from '@/utils/format';

export interface AnimatedNumberProps {
  value: number;
  duration?: number;
  style?: StyleProp<TextStyle>;
  suffix?: string;
  prefix?: string;
}

export function AnimatedNumber({
  value,
  duration = 800,
  style,
  suffix = '',
  prefix = '',
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const previousValueRef = useRef(0);

  useEffect(() => {
    const startValue = previousValueRef.current;
    const targetValue = value;
    previousValueRef.current = targetValue;

    if (startValue === targetValue) {
      setDisplayValue(targetValue);
      return;
    }

    const startTime = Date.now();
    let frameId: number;

    const updateCounter = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + (targetValue - startValue) * easeOut);

      setDisplayValue(current);

      if (progress < 1) {
        frameId = requestAnimationFrame(updateCounter);
      } else {
        setDisplayValue(targetValue);
      }
    };

    frameId = requestAnimationFrame(updateCounter);
    return () => cancelAnimationFrame(frameId);
  }, [value, duration]);

  return (
    <Text style={[styles.tabular, style]}>
      {prefix}
      {formatNumber(displayValue)}
      {suffix ? ` ${suffix}` : ''}
    </Text>
  );
}

const styles = StyleSheet.create({
  tabular: {
    fontVariant: ['tabular-nums'],
  },
});
