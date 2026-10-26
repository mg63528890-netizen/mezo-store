import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NeuView } from '@/components/neu/NeuView';
import { NeuButton } from '@/components/neu/NeuButton';

export interface AddInvoiceBarProps {
  title?: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export function AddInvoiceBar({
  title = 'إضافة الفاتورة',
  onPress,
  disabled = false,
  loading = false,
}: AddInvoiceBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.outerContainer,
        {
          bottom: Math.max(insets.bottom + 8, 14),
        },
      ]}
    >
      <NeuView variant="raised" radius={30} style={styles.barPill}>
        <NeuButton
          title={title}
          variant="gold"
          onPress={onPress}
          disabled={disabled}
          loading={loading}
          radius={22}
          style={styles.button}
        />
      </NeuView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 999,
  },
  barPill: {
    height: 64,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    width: '100%',
    height: 48,
  },
});
