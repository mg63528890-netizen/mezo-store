import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '@/theme/ThemeContext';
import { NeuView } from './NeuView';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export interface NeuSegmentedProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}

export function NeuSegmented<T extends string>({
  options,
  value,
  onChange,
  style,
  compact = false,
}: NeuSegmentedProps<T>) {
  const { colors, isDark } = useAppTheme();

  const handleSelect = (val: T) => {
    if (val === value) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onChange(val);
  };

  return (
    <NeuView
      variant="pressed"
      radius={compact ? 14 : 18}
      style={[
        styles.container,
        compact ? styles.compactContainer : styles.standardContainer,
        style,
      ]}
    >
      <View style={styles.row}>
        {options.map((opt) => {
          const isSelected = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => handleSelect(opt.value)}
              style={[
                styles.segment,
                isSelected && styles.selectedSegmentWrapper,
              ]}
            >
              {isSelected ? (
                <View
                  style={[
                    styles.activePill,
                    {
                      backgroundColor: colors.surface,
                      boxShadow: [
                        {
                          offsetX: 0,
                          offsetY: 2,
                          blurRadius: 5,
                          color: isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.12)',
                        },
                        {
                          offsetX: 0,
                          offsetY: 1,
                          blurRadius: 2,
                          color: isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.05)',
                        },
                      ],
                    },
                    compact ? styles.compactActivePill : styles.standardActivePill,
                  ]}
                >
                  <Text
                    style={[
                      styles.activeText,
                      { color: colors.accent },
                      compact && styles.compactText,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </View>
              ) : (
                <View
                  style={[
                    styles.inactivePill,
                    compact ? styles.compactInactivePill : styles.standardInactivePill,
                  ]}
                >
                  <Text
                    style={[
                      styles.inactiveText,
                      { color: colors.textMuted },
                      compact && styles.compactText,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </NeuView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 3,
  },
  standardContainer: {
    height: 50,
    borderRadius: 22,
  },
  compactContainer: {
    height: 44,
    borderRadius: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  segment: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedSegmentWrapper: {
    zIndex: 1,
  },
  activePill: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  standardActivePill: {
    borderRadius: 18,
  },
  compactActivePill: {
    borderRadius: 14,
  },
  inactivePill: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  standardInactivePill: {
    borderRadius: 18,
  },
  compactInactivePill: {
    borderRadius: 14,
  },
  activeText: {
    fontFamily: 'Tajawal-Bold',
    fontSize: 14,
    lineHeight: 24,
    textAlign: 'center',
    includeFontPadding: false,
  },
  inactiveText: {
    fontFamily: 'Tajawal-Bold',
    fontSize: 14,
    lineHeight: 24,
    textAlign: 'center',
    includeFontPadding: false,
  },
  compactText: {
    fontSize: 13,
    lineHeight: 22,
  },
});
