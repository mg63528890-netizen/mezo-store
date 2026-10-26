import React from 'react';
import {
  Text,
  Pressable,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '@/theme/ThemeContext';
import { NeuView } from './NeuView';

export interface NeuChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

export function NeuChip({ label, selected, onPress, style }: NeuChipProps) {
  const { colors } = useAppTheme();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };

  return (
    <Pressable onPress={handlePress} style={style}>
      <NeuView
        variant={selected ? 'pressed' : 'raised'}
        radius={18}
        style={styles.chip}
      >
        <Text
          style={[
            styles.label,
            { color: selected ? colors.accent : colors.textMuted },
            selected && styles.selectedLabel,
          ]}
        >
          {label}
        </Text>
      </NeuView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  label: {
    fontSize: 13,
    fontFamily: 'Tajawal-Bold',
    lineHeight: 22,
    textAlign: 'center',
    includeFontPadding: false,
  },
  selectedLabel: {
    fontFamily: 'Tajawal-Bold',
  },
});
