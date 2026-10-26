import React, { useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ViewStyle,
  StyleProp,
  I18nManager,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '@/theme/ThemeContext';
import { NeuView } from './NeuView';

export interface NeuSwitchProps {
  value: boolean;
  onValueChange: (newValue: boolean) => void;
  title?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function NeuSwitch({
  value,
  onValueChange,
  title,
  disabled = false,
  style,
}: NeuSwitchProps) {
  const { colors, isDark } = useAppTheme();
  const isRTL = I18nManager.isRTL;
  // Track width: 52, thumb: 24, padding: 3 -> travel distance is 22px
  // In RTL, thumb starts naturally at the RIGHT edge (offset 0):
  // - OFF (resting left): translateX is -22 (moves left 22px inside the track)
  // - ON (active right): translateX is 0 (stays at the right edge inside the track)
  // In LTR, thumb starts naturally at the LEFT edge (offset 0):
  // - OFF (resting left): translateX is 0 (stays at the left edge inside the track)
  // - ON (active right): translateX is 22 (moves right 22px inside the track)
  const targetOffset = isRTL ? (value ? 0 : -22) : (value ? 22 : 0);
  const offset = useSharedValue(targetOffset);

  useEffect(() => {
    offset.value = withSpring(targetOffset, {
      damping: 18,
      stiffness: 280,
    });
  }, [targetOffset, offset]);

  const thumbAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  const handleToggle = () => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onValueChange(!value);
  };

  const switchControl = (
    <Pressable onPress={handleToggle} disabled={disabled}>
      <NeuView
        variant="pressed"
        radius={16}
        style={[
          styles.track,
          value && { backgroundColor: isDark ? '#2A261C' : '#EDE8DC' },
        ]}
      >
        <Animated.View
          style={[
            styles.thumb,
            {
              backgroundColor: value ? colors.accent : isDark ? '#4A4F58' : '#7A7F88',
              boxShadow: [
                {
                  offsetX: 2,
                  offsetY: 2,
                  blurRadius: 4,
                  color: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.25)',
                },
              ],
            },
            thumbAnimatedStyle,
          ]}
        />
      </NeuView>
    </Pressable>
  );

  if (title) {
    return (
      <NeuView variant="raised" radius={18} style={[styles.cardRow, style]}>
        <View style={styles.cardContent}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
          {switchControl}
        </View>
      </NeuView>
    );
  }

  return switchControl;
}

const styles = StyleSheet.create({
  cardRow: {
    marginVertical: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: '100%',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: 'Tajawal-Bold',
  },
  track: {
    width: 52,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
});
