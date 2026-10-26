import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import { useAppTheme } from '@/theme/ThemeContext';

export type NeuVariant = 'raised' | 'pressed' | 'gold' | 'danger' | 'flat';

export interface NeuViewProps {
  variant?: NeuVariant;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function NeuView({
  variant = 'raised',
  radius = 20,
  style,
  children,
}: NeuViewProps) {
  const { colors, isDark } = useAppTheme();

  const getStyleForVariant = (): ViewStyle => {
    switch (variant) {
      case 'raised':
        return {
          backgroundColor: colors.surface,
          borderRadius: radius,
          // React Native 0.76+ dual boxShadow
          boxShadow: [
            {
              offsetX: 7,
              offsetY: 7,
              blurRadius: 16,
              color: colors.shadowDark,
            },
            {
              offsetX: -7,
              offsetY: -7,
              blurRadius: 16,
              color: colors.shadowLight,
            },
          ],
        };
      case 'pressed':
        return {
          backgroundColor: isDark ? '#1C1E22' : '#E0E3E8',
          borderRadius: radius,
          boxShadow: [
            {
              offsetX: 4,
              offsetY: 4,
              blurRadius: 9,
              color: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(180, 185, 194, 0.8)',
              inset: true,
            },
            {
              offsetX: -4,
              offsetY: -4,
              blurRadius: 9,
              color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.9)',
              inset: true,
            },
          ],
        };
      case 'gold':
        return {
          backgroundColor: colors.accent,
          borderRadius: radius,
          boxShadow: [
            {
              offsetX: 0,
              offsetY: 6,
              blurRadius: 16,
              color: isDark ? 'rgba(201, 169, 106, 0.35)' : 'rgba(169, 131, 63, 0.45)',
            },
          ],
        };
      case 'danger':
        return {
          backgroundColor: '#B01E1E',
          borderRadius: radius,
          boxShadow: [
            {
              offsetX: 0,
              offsetY: 6,
              blurRadius: 16,
              color: 'rgba(176, 30, 30, 0.45)',
            },
          ],
        };
      case 'flat':
      default:
        return {
          backgroundColor: colors.surface,
          borderRadius: radius,
        };
    }
  };

  return <View style={[getStyleForVariant(), style]}>{children}</View>;
}
