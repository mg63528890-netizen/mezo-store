import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useAppTheme } from '@/theme/ThemeContext';

export interface EmptyStateProps {
  message: string;
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({ message, style }: EmptyStateProps) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.message, { color: colors.textMuted }]}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 36,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  message: {
    fontSize: 15,
    fontFamily: 'Tajawal-Medium',
    textAlign: 'center',
  },
});
