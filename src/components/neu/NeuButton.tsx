import React from 'react';
import {
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '@/theme/ThemeContext';
import { NeuView, NeuVariant } from './NeuView';

export interface NeuButtonProps {
  title?: string;
  variant?: 'gold' | 'secondary' | 'danger' | 'circle';
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  radius?: number;
  height?: number;
  haptic?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function NeuButton({
  title,
  variant = 'gold',
  onPress,
  disabled = false,
  loading = false,
  icon,
  style,
  textStyle,
  radius = 18,
  height: heightProp,
  haptic = true,
}: NeuButtonProps) {
  const { colors } = useAppTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (disabled || loading) return;
    scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const handlePress = () => {
    if (disabled || loading) return;
    if (haptic) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress?.();
  };

  // Determine NeuView variant
  let neuVariant: NeuVariant = 'gold';
  let defaultTextColor = '#FFFFFF';
  let height = heightProp ?? 52;

  if (variant === 'gold') {
    neuVariant = 'gold';
    defaultTextColor = '#FFFFFF';
  } else if (variant === 'secondary') {
    neuVariant = 'raised';
    defaultTextColor = colors.text;
  } else if (variant === 'danger') {
    neuVariant = 'danger';
    defaultTextColor = '#FFFFFF';
  } else if (variant === 'circle') {
    neuVariant = 'raised';
    radius = 50;
    if (!heightProp) height = 46;
  }

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      style={[
        animatedStyle,
        disabled && styles.disabled,
        variant === 'circle' ? styles.circleWrapper : styles.buttonWrapper,
        style,
      ]}
    >
      <NeuView
        variant={neuVariant}
        radius={radius}
        style={[
          variant === 'circle' ? styles.circleContent : styles.buttonContent,
          variant !== 'circle' && { height },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={defaultTextColor} size="small" />
        ) : (
          <>
            {icon}
            {title ? (
              <Text
                style={[
                  styles.buttonText,
                  { color: defaultTextColor },
                  icon ? styles.textWithIcon : undefined,
                  textStyle,
                ]}
              >
                {title}
              </Text>
            ) : null}
          </>
        )}
      </NeuView>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  buttonWrapper: {
    width: '100%',
  },
  circleWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContent: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  circleContent: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: 'Tajawal-Bold',
    fontSize: 16,
    lineHeight: 24,
    paddingTop: 2,
    paddingBottom: 2,
    textAlign: 'center',
  },
  textWithIcon: {
    marginHorizontal: 8,
  },
  disabled: {
    opacity: 0.45,
  },
});
