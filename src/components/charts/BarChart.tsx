import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  LayoutChangeEvent,
  I18nManager,
} from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '@/theme/ThemeContext';
import { formatCurrency, formatShortDate } from '@/utils/format';
import { NeuView } from '@/components/neu/NeuView';

export interface ChartDataPoint {
  label?: string; // e.g. "5 أكتوبر" or "1" or "ينا"
  fullLabel?: string;
  full_label?: string;
  value: number; // Amount in EGP
  isFuture?: boolean;
  is_future?: boolean;
  month_idx?: number;
  date?: string;
}

export interface BarChartProps {
  data: ChartDataPoint[];
  height?: number;
  isMonthView?: boolean;
  mode?: 'week' | 'month' | 'year';
  barColor?: string;
}

const AR_MONTH_NAMES = [
  'ينا', 'فبر', 'مار', 'أبر', 'مايو', 'يون',
  'يول', 'أغس', 'سبت', 'أكت', 'نوف', 'ديس'
];

export function BarChart({
  data,
  height = 140,
  isMonthView = false,
  mode,
  barColor,
}: BarChartProps) {
  const isRTL = I18nManager.isRTL;
  const isMonth = mode === 'month' || isMonthView;
  const { colors, isDark } = useAppTheme();
  const activeColor = barColor || colors.accent;
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [containerWidth, setContainerWidth] = useState(300);

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setContainerWidth(w);
  };

  const maxValue = Math.max(...data.map((d) => d.value), 0);
  const chartHeight = height - (isMonth ? 52 : 36);

  // Compute bar widths and gaps
  const paddingH = 14;
  const availableWidth = containerWidth - paddingH * 2;
  const count = data.length || 1;
  const barWidth = Math.max(isMonth ? 5 : 20, (availableWidth / count) * (isMonth ? 0.6 : 0.65));
  const slotWidth = availableWidth / count;

  const handleSelectBar = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedIdx(selectedIdx === index ? null : index);
  };

  const getItemLabel = (item: ChartDataPoint, idx: number) => {
    if (item.month_idx !== undefined && AR_MONTH_NAMES[item.month_idx]) {
      return AR_MONTH_NAMES[item.month_idx];
    }
    if ((mode === 'week' || data.length === 7) && item.date) {
      try {
        const d = new Date(item.date.includes('T') ? item.date : `${item.date}T12:00:00Z`);
        const locale = isRTL ? 'ar-EG-u-nu-latn' : 'en-US';
        return new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'Africa/Cairo' }).format(d);
      } catch {
        // fallback
      }
    }
    return item.label || String(idx + 1);
  };

  const getTooltipContent = (item: ChartDataPoint, idx: number) => {
    let title = item.fullLabel || item.full_label;
    if (!title && item.date) {
      try {
        title = formatShortDate(item.date);
      } catch {
        // fallback
      }
    }
    if (!title) {
      title = getItemLabel(item, idx);
    }
    return `${title}: ${formatCurrency(item.value)}`;
  };

  const selectedItem = selectedIdx !== null ? data[selectedIdx] : null;

  return (
    <View style={styles.wrapper} onLayout={handleLayout}>
      {/* Tooltip on tap */}
      {selectedItem ? (
        <View style={styles.tooltipContainer}>
          <NeuView variant="raised" radius={10} style={styles.tooltipPill}>
            <Text style={[styles.tooltipText, { color: activeColor }]}>
              {getTooltipContent(selectedItem, selectedIdx!)}
            </Text>
          </NeuView>
        </View>
      ) : null}

      <NeuView variant="pressed" radius={20} style={[styles.container, { height }]}>
        <View style={[styles.svgArea, { height: chartHeight, paddingHorizontal: paddingH }]}>
          <Svg width={availableWidth} height={chartHeight}>
            {data.map((item, idx) => {
              const slotIndex = isRTL ? count - 1 - idx : idx;
              const xPos = slotIndex * slotWidth + (slotWidth - barWidth) / 2;
              const hasData = item.value > 0;
              const isSelected = selectedIdx === idx;
              const isFuture = !!(item.isFuture || item.is_future);

              // Compute bar height
              const barH = hasData && maxValue > 0
                ? Math.max(12, (item.value / maxValue) * (chartHeight - 16))
                : 4; // Baseline stub

              const yPos = chartHeight - barH - 4;

              let fillColor = isDark ? '#2D323A' : '#D0D4DC';
              let barOpacity = 0.45;

              if (isFuture) {
                fillColor = isDark ? '#22252A' : '#E0E3E8';
                barOpacity = 0.25;
              } else if (hasData) {
                // All bars with data are distinguished with the active accent color
                fillColor = activeColor;
                barOpacity = selectedIdx !== null ? (isSelected ? 1 : 0.65) : 1;
              }

              return (
                <Rect
                  key={idx}
                  x={xPos}
                  y={yPos}
                  width={barWidth}
                  height={barH}
                  rx={barWidth / 2}
                  fill={fillColor}
                  opacity={barOpacity}
                  onPress={() => handleSelectBar(idx)}
                />
              );
            })}
          </Svg>
        </View>

        {/* Labels underneath */}
        <View style={[styles.labelsRow, { paddingHorizontal: paddingH }]}>
          {isMonth ? (
            // Two staggered rows for days 1-31
            <View style={styles.monthLabelsContainer}>
              <View style={styles.staggeredRow}>
                {data.map((item, idx) => {
                  const isOdd = (idx + 1) % 2 !== 0;
                  const hasData = item.value > 0;
                  const isSelected = selectedIdx === idx;
                  return (
                    <Text
                      key={`r1-${idx}`}
                      style={[
                        styles.monthDayText,
                        {
                          color: isSelected ? activeColor : hasData ? colors.text : colors.textMuted,
                          fontFamily: isSelected || hasData ? 'Tajawal-Bold' : 'Tajawal-Regular',
                          opacity: isOdd ? 1 : 0,
                        },
                      ]}
                    >
                      {idx + 1}
                    </Text>
                  );
                })}
              </View>
              <View style={styles.staggeredRow}>
                {data.map((item, idx) => {
                  const isEven = (idx + 1) % 2 === 0;
                  const hasData = item.value > 0;
                  const isSelected = selectedIdx === idx;
                  return (
                    <Text
                      key={`r2-${idx}`}
                      style={[
                        styles.monthDayText,
                        {
                          color: isSelected ? activeColor : hasData ? colors.text : colors.textMuted,
                          fontFamily: isSelected || hasData ? 'Tajawal-Bold' : 'Tajawal-Regular',
                          opacity: isEven ? 1 : 0,
                        },
                      ]}
                    >
                      {idx + 1}
                    </Text>
                  );
                })}
              </View>
            </View>
          ) : (
            // Standard row for week / year
            data.map((item, idx) => {
              const hasData = item.value > 0;
              const isSelected = selectedIdx === idx;
              return (
                <Pressable
                  key={idx}
                  onPress={() => handleSelectBar(idx)}
                  style={[styles.labelItem, { width: slotWidth }]}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.labelText,
                      {
                        color: isSelected
                          ? activeColor
                          : hasData
                          ? colors.text
                          : colors.textMuted,
                        fontFamily: isSelected || hasData ? 'Tajawal-Bold' : 'Tajawal-Regular',
                      },
                    ]}
                  >
                    {getItemLabel(item, idx)}
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>
      </NeuView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 10,
    width: '100%',
  },
  tooltipContainer: {
    alignItems: 'center',
    marginBottom: 6,
  },
  tooltipPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  tooltipText: {
    fontSize: 12,
    fontFamily: 'Tajawal-Bold',
  },
  container: {
    width: '100%',
    paddingVertical: 10,
    justifyContent: 'space-between',
  },
  svgArea: {
    width: '100%',
    justifyContent: 'flex-end',
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  labelItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelText: {
    fontSize: 10.5,
    textAlign: 'center',
  },
  monthLabelsContainer: {
    width: '100%',
  },
  staggeredRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  monthDayText: {
    fontSize: 8.5,
    fontFamily: 'Tajawal-Regular',
    textAlign: 'center',
  },
});
