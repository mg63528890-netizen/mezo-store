import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
  I18nManager,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '@/theme/ThemeContext';
import { NeuSheet } from './NeuSheet';
import { NeuButton } from './NeuButton';
import { NeuView } from './NeuView';

const ROW_HEIGHT = 42;
const VISIBLE_ROWS = 5;

const ARABIC_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

const ENGLISH_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

interface WheelColumnProps {
  items: { label: string; value: number }[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

function WheelColumn({ items, selectedIndex, onSelect }: WheelColumnProps) {
  const { colors } = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);
  const lastIndexRef = useRef(selectedIndex);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        y: selectedIndex * ROW_HEIGHT,
        animated: false,
      });
    }
  }, [selectedIndex]);

  const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const index = Math.round(y / ROW_HEIGHT);
    const clamped = Math.max(0, Math.min(items.length - 1, index));
    if (clamped !== lastIndexRef.current) {
      lastIndexRef.current = clamped;
      Haptics.selectionAsync().catch(() => {});
      onSelect(clamped);
    }
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const index = Math.round(y / ROW_HEIGHT);
    const clamped = Math.max(0, Math.min(items.length - 1, index));
    if (clamped !== lastIndexRef.current) {
      lastIndexRef.current = clamped;
      Haptics.selectionAsync().catch(() => {});
    }
  };

  return (
    <View style={styles.columnContainer}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW_HEIGHT}
        decelerationRate="fast"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        contentContainerStyle={{
          paddingVertical: ((VISIBLE_ROWS - 1) / 2) * ROW_HEIGHT,
        }}
      >
        {items.map((item, idx) => {
          const isSelected = idx === selectedIndex;
          const distance = Math.abs(idx - selectedIndex);
          const opacity = distance === 0 ? 1 : distance === 1 ? 0.6 : 0.25;

          return (
            <View key={item.value} style={styles.rowItem}>
              <Text
                style={[
                  styles.itemText,
                  {
                    color: isSelected ? colors.accent : colors.text,
                    opacity,
                    fontFamily: isSelected ? 'Tajawal-Bold' : 'Tajawal-Regular',
                  },
                ]}
              >
                {item.label}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

export interface NeuWheelDatePickerProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  initialDate?: Date;
  onConfirm: (date: Date) => void;
}

export function NeuWheelDatePicker({
  visible,
  onClose,
  title,
  initialDate,
  onConfirm,
}: NeuWheelDatePickerProps) {
  const isRTL = I18nManager.isRTL;
  const today = new Date();

  const [selectedYear, setSelectedYear] = useState(
    initialDate ? initialDate.getFullYear() : today.getFullYear()
  );
  const [selectedMonth, setSelectedMonth] = useState(
    initialDate ? initialDate.getMonth() : today.getMonth()
  );
  const [selectedDay, setSelectedDay] = useState(
    initialDate ? initialDate.getDate() : today.getDate()
  );

  // Available years: last 5 years up to today's year (clamped to today)
  const currentYear = today.getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => currentYear - 5 + i).reverse();

  // Months
  const months = isRTL ? ARABIC_MONTHS : ENGLISH_MONTHS;

  // Days in selected month
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const effectiveDay = Math.min(selectedDay, daysInMonth);

  const handleConfirm = () => {
    let date = new Date(selectedYear, selectedMonth, effectiveDay);
    if (date > today) {
      date = today;
    }
    onConfirm(date);
    onClose();
  };

  const dayIndex = Math.max(0, days.indexOf(selectedDay));
  const monthIndex = Math.max(0, selectedMonth);
  const yearIndex = Math.max(0, years.indexOf(selectedYear));

  return (
    <NeuSheet visible={visible} onClose={onClose} title={title}>
      <NeuView variant="pressed" radius={20} style={styles.pickerContainer}>
        {/* Center Raised Selection Band */}
        <View pointerEvents="none" style={styles.selectionBandWrapper}>
          <NeuView variant="raised" radius={12} style={styles.selectionBand} />
        </View>

        <View style={styles.wheelsRow}>
          {isRTL ? (
            <>
              {/* Day */}
              <WheelColumn
                items={days.map((d) => ({ label: d.toString(), value: d }))}
                selectedIndex={dayIndex}
                onSelect={(idx) => setSelectedDay(days[idx])}
              />
              {/* Month */}
              <WheelColumn
                items={months.map((m, idx) => ({ label: m, value: idx }))}
                selectedIndex={monthIndex}
                onSelect={(idx) => setSelectedMonth(idx)}
              />
              {/* Year */}
              <WheelColumn
                items={years.map((y) => ({ label: y.toString(), value: y }))}
                selectedIndex={yearIndex}
                onSelect={(idx) => setSelectedYear(years[idx])}
              />
            </>
          ) : (
            <>
              {/* Year */}
              <WheelColumn
                items={years.map((y) => ({ label: y.toString(), value: y }))}
                selectedIndex={yearIndex}
                onSelect={(idx) => setSelectedYear(years[idx])}
              />
              {/* Month */}
              <WheelColumn
                items={months.map((m, idx) => ({ label: m, value: idx }))}
                selectedIndex={monthIndex}
                onSelect={(idx) => setSelectedMonth(idx)}
              />
              {/* Day */}
              <WheelColumn
                items={days.map((d) => ({ label: d.toString(), value: d }))}
                selectedIndex={dayIndex}
                onSelect={(idx) => setSelectedDay(days[idx])}
              />
            </>
          )}
        </View>
      </NeuView>

      <NeuButton
        title="تم"
        variant="gold"
        onPress={handleConfirm}
        style={styles.confirmButton}
      />
    </NeuSheet>
  );
}

const styles = StyleSheet.create({
  pickerContainer: {
    height: ROW_HEIGHT * VISIBLE_ROWS,
    marginVertical: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  selectionBandWrapper: {
    position: 'absolute',
    top: ROW_HEIGHT * 2,
    left: 8,
    right: 8,
    height: ROW_HEIGHT,
    zIndex: 1,
  },
  selectionBand: {
    width: '100%',
    height: '100%',
  },
  wheelsRow: {
    flexDirection: 'row',
    height: '100%',
    zIndex: 2,
  },
  columnContainer: {
    flex: 1,
    height: '100%',
  },
  rowItem: {
    height: ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    fontSize: 16,
    textAlign: 'center',
  },
  confirmButton: {
    marginTop: 8,
  },
});
