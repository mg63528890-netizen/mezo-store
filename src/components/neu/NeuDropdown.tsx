import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { ChevronDown } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '@/theme/ThemeContext';
import { NeuView } from './NeuView';

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
}

export interface NeuDropdownProps<T extends string> {
  label?: string;
  options: DropdownOption<T>[];
  selectedValue: T;
  onSelect: (value: T) => void;
  style?: StyleProp<ViewStyle>;
  placeholder?: string;
}

export function NeuDropdown<T extends string>({
  label,
  options,
  selectedValue,
  onSelect,
  style,
  placeholder,
}: NeuDropdownProps<T>) {
  const { colors, isDark } = useAppTheme();
  const [isOpen, setIsOpen] = useState(false);
  const rotation = useSharedValue(0);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const toggleDropdown = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    rotation.value = withSpring(nextState ? 180 : 0, {
      damping: 18,
      stiffness: 250,
    });
  };

  const handleSelect = (val: T) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onSelect(val);
    toggleDropdown();
  };

  const selectedOption = options.find((o) => o.value === selectedValue);
  const displayLabel = selectedOption ? selectedOption.label : placeholder || '';

  return (
    <View style={[styles.container, style]}>
      {label ? (
        <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      ) : null}

      <Pressable onPress={toggleDropdown}>
        <NeuView variant="pressed" radius={16} style={styles.trigger}>
          <Text style={[styles.triggerText, { color: colors.text }]}>
            {displayLabel}
          </Text>
          <Animated.View style={chevronStyle}>
            <ChevronDown size={18} color={colors.textMuted} />
          </Animated.View>
        </NeuView>
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={toggleDropdown}
      >
        <Pressable style={styles.modalOverlay} onPress={toggleDropdown}>
          <Pressable style={styles.popoverContainer} onPress={(e) => e.stopPropagation()}>
            <View
              style={[
                styles.popover,
                {
                  backgroundColor: colors.surface,
                  borderRadius: 18,
                  boxShadow: [
                    {
                      offsetX: 0,
                      offsetY: 8,
                      blurRadius: 24,
                      color: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.16)',
                    },
                    {
                      offsetX: 0,
                      offsetY: 2,
                      blurRadius: 6,
                      color: isDark ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.06)',
                    },
                  ],
                },
              ]}
            >
              {options.map((opt) => {
                const isSelected = opt.value === selectedValue;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => handleSelect(opt.value)}
                    style={styles.optionRow}
                  >
                    {isSelected ? (
                      <NeuView variant="pressed" radius={12} style={styles.selectedRowPill}>
                        <Text style={[styles.optionText, { color: colors.accent, fontFamily: 'Tajawal-Bold' }]}>
                          {opt.label}
                        </Text>
                      </NeuView>
                    ) : (
                      <View style={styles.unselectedRowPill}>
                        <Text style={[styles.optionText, { color: colors.text }]}>
                          {opt.label}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
  },
  label: {
    fontSize: 13,
    fontFamily: 'Tajawal-Medium',
    lineHeight: 18,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  trigger: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  triggerText: {
    fontSize: 15,
    fontFamily: 'Tajawal-Bold',
    lineHeight: 22,
    paddingTop: 3,
    paddingBottom: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  popoverContainer: {
    width: '100%',
    maxWidth: 320,
  },
  popover: {
    padding: 8,
  },
  optionRow: {
    marginVertical: 3,
  },
  selectedRowPill: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unselectedRowPill: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    fontSize: 15,
    fontFamily: 'Tajawal-Bold',
    lineHeight: 22,
    paddingTop: 3,
    paddingBottom: 1,
    textAlign: 'center',
  },
});
