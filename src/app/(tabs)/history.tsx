import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAppTheme } from '@/theme/ThemeContext';
import { formatCurrency, formatShortDate } from '@/utils/format';
import { api, InvoiceItem } from '@/data/api';
import { supabase } from '@/data/supabase';
import { TopBar } from '@/components/navigation/TopBar';
import { NeuView } from '@/components/neu/NeuView';
import { NeuSegmented } from '@/components/neu/NeuSegmented';
import { NeuChip } from '@/components/neu/NeuChip';
import { NeuInput } from '@/components/neu/NeuInput';
import { NeuWheelDatePicker } from '@/components/neu/NeuWheelDatePicker';
import { EmptyState } from '@/components/neu/EmptyState';

type KindType = 'sale' | 'purchase';
type FilterType = 'none' | 'weekly' | 'monthly' | 'custom';

export default function HistoryScreen() {
  const { colors } = useAppTheme();
  const [kind, setKind] = useState<KindType>('sale');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('none');

  // Custom date bounds
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);

  // Date picker state
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'from' | 'to'>('from');

  // Data state
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalSum, setTotalSum] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Format YYYY-MM-DD for Cairo bounds
  const formatDateParam = (d: Date | null) => {
    if (!d) return null;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const loadInvoices = useCallback(async () => {
    try {
      let fromParam: string | null = null;
      let toParam: string | null = null;

      const today = new Date();

      if (filter === 'weekly') {
        // Current week starting Saturday (WEEK_START = 6)
        const dayOfWeek = today.getDay(); // 0 is Sunday, 6 is Saturday
        const diffToSaturday = (dayOfWeek + 1) % 7;
        const saturday = new Date(today);
        saturday.setDate(today.getDate() - diffToSaturday);
        fromParam = formatDateParam(saturday);
        toParam = formatDateParam(today);
      } else if (filter === 'monthly') {
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        fromParam = formatDateParam(monthStart);
        toParam = formatDateParam(today);
      } else if (filter === 'custom') {
        fromParam = formatDateParam(fromDate);
        toParam = formatDateParam(toDate);
      }

      const res = await api.listInvoices({
        kind,
        from_date: fromParam,
        to_date: toParam,
        search: search.trim() || null,
      });

      setInvoices(res?.items || []);
      setTotalCount(res?.summary?.count || 0);
      setTotalSum(res?.summary?.total || 0);
    } catch {
      // Ignore network errors
    } finally {
      setRefreshing(false);
    }
  }, [filter, fromDate, toDate, kind, search]);

  useFocusEffect(
    useCallback(() => {
      loadInvoices();
    }, [loadInvoices])
  );

  useEffect(() => {
    // Realtime subscription to data_version
    const channel = supabase
      .channel('history_data_version_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'data_version' },
        () => {
          loadInvoices();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadInvoices]);

  const onRefresh = () => {
    setRefreshing(true);
    loadInvoices();
  };

  const handleChipPress = (selectedFilter: FilterType) => {
    if (filter === selectedFilter) {
      setFilter('none');
    } else {
      setFilter(selectedFilter);
    }
  };

  const handleOpenDatePicker = (target: 'from' | 'to') => {
    setPickerTarget(target);
    setDatePickerVisible(true);
  };

  const handleDateConfirm = (selectedDate: Date) => {
    if (pickerTarget === 'from') {
      if (toDate && selectedDate > toDate) {
        // Swap bounds if "from" > "to"
        setFromDate(toDate);
        setToDate(selectedDate);
      } else {
        setFromDate(selectedDate);
      }
    } else {
      if (fromDate && selectedDate < fromDate) {
        // Swap bounds if "to" < "from"
        setToDate(fromDate);
        setFromDate(selectedDate);
      } else {
        setToDate(selectedDate);
      }
    }
  };

  const clearAllFilters = () => {
    setFilter('none');
    setFromDate(null);
    setToDate(null);
    setSearch('');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <TopBar isRoot />

      {/* Screen Header Row: Title «السجل» + Segmented «البيع | الشراء» */}
      <View style={styles.headerRow}>
        <Text style={[styles.pageTitle, { color: colors.text }]}>السجل</Text>

        <View style={styles.segmentedWrapper}>
          <NeuSegmented
            compact
            options={[
              { value: 'sale', label: 'البيع' },
              { value: 'purchase', label: 'الشراء' },
            ]}
            value={kind}
            onChange={(val) => setKind(val as KindType)}
          />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      >
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <NeuInput
            value={search}
            onChangeText={setSearch}
            placeholder="ابحث برقم الفاتورة أو الاسم"
            style={styles.searchInput}
          />
        </View>

        {/* Filter Chips: أسبوعي · شهري · محدد */}
        <View style={styles.chipsRow}>
          <NeuChip
            label="أسبوعي"
            selected={filter === 'weekly'}
            onPress={() => handleChipPress('weekly')}
          />
          <NeuChip
            label="شهري"
            selected={filter === 'monthly'}
            onPress={() => handleChipPress('monthly')}
          />
          <NeuChip
            label="محدد"
            selected={filter === 'custom'}
            onPress={() => handleChipPress('custom')}
          />
        </View>

        {/* Custom Date Pickers (Shown only when 'محدد' is active) */}
        {filter === 'custom' ? (
          <View style={styles.customDateRow}>
            <Pressable
              onPress={() => handleOpenDatePicker('from')}
              style={styles.datePickerField}
            >
              <Text style={[styles.dateLabel, { color: colors.textMuted }]}>
                من:
              </Text>
              <NeuView variant="pressed" radius={14} style={styles.datePill}>
                <Text style={[styles.dateText, { color: colors.text }]}>
                  {fromDate ? formatShortDate(fromDate) : '—'}
                </Text>
              </NeuView>
            </Pressable>

            <Pressable
              onPress={() => handleOpenDatePicker('to')}
              style={styles.datePickerField}
            >
              <Text style={[styles.dateLabel, { color: colors.textMuted }]}>
                إلى:
              </Text>
              <NeuView variant="pressed" radius={14} style={styles.datePill}>
                <Text style={[styles.dateText, { color: colors.text }]}>
                  {toDate ? formatShortDate(toDate) : '—'}
                </Text>
              </NeuView>
            </Pressable>
          </View>
        ) : null}

        {/* Summary Line: Count + Total Sum */}
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryTotal, { color: colors.accent }]}>
            {formatCurrency(totalSum)}
          </Text>
          <View style={styles.summaryMetaRow}>
            <Text style={[styles.summaryCount, { color: colors.textMuted }]}>
              {totalCount} فاتورة
            </Text>
            {filter !== 'none' || search ? (
              <Pressable onPress={clearAllFilters} style={styles.clearBtn}>
                <Text style={[styles.clearText, { color: colors.danger }]}>
                  · مسح الفلاتر
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Invoice List */}
        {invoices.length === 0 ? (
          <EmptyState message="لا توجد فواتير" />
        ) : (
          <View style={styles.invoiceList}>
            {invoices.map((item) => {
              const isCancelled = item.status === 'cancelled';
              return (
                <Pressable
                  key={item.id}
                  onPress={() => router.push(`/invoice/${item.id}` as any)}
                >
                  <NeuView variant="raised" radius={18} style={styles.invoiceCard}>
                    {/* Amount on trailing side */}
                    <View style={styles.amountSide}>
                      <Text
                        style={[
                          styles.invoiceAmount,
                          {
                            color: isCancelled ? colors.textMuted : colors.text,
                            textDecorationLine: isCancelled ? 'line-through' : 'none',
                          },
                        ]}
                      >
                        {formatCurrency(item.total)}
                      </Text>
                    </View>

                    {/* Details on leading side */}
                    <View style={styles.detailsSide}>
                      <View style={styles.cardHeader}>
                        <Text style={[styles.deviceTitle, { color: colors.text }]}>
                          {item.device_type}
                        </Text>
                        {item.is_new_device ? (
                          <Text style={[styles.newTag, { color: colors.success }]}>
                            جديد
                          </Text>
                        ) : null}
                        {isCancelled ? (
                          <View style={styles.cancelledBadge}>
                            <Text style={styles.cancelledText}>ملغاة</Text>
                          </View>
                        ) : null}
                      </View>

                      <Text style={[styles.metaText, { color: colors.textMuted }]}>
                        {formatShortDate(item.created_at)} · {item.number}
                      </Text>
                    </View>
                  </NeuView>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Wheel Date Picker Sheet */}
      <NeuWheelDatePicker
        visible={datePickerVisible}
        onClose={() => setDatePickerVisible(false)}
        title={pickerTarget === 'from' ? 'من تاريخ' : 'إلى تاريخ'}
        initialDate={pickerTarget === 'from' ? fromDate || undefined : toDate || undefined}
        onConfirm={handleDateConfirm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 4,
  },
  pageTitle: {
    fontFamily: 'Tajawal-Bold',
    fontSize: 24,
  },
  segmentedWrapper: {
    width: 160,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 125,
  },
  searchContainer: {
    width: '100%',
  },
  searchInput: {
    paddingHorizontal: 12,
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  customDateRow: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 6,
  },
  datePickerField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateLabel: {
    fontSize: 13,
    fontFamily: 'Tajawal-Medium',
    lineHeight: 18,
    paddingTop: 1,
  },
  datePill: {
    flex: 1,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  dateText: {
    fontSize: 13,
    fontFamily: 'Tajawal-Bold',
    lineHeight: 18,
    paddingTop: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  summaryTotal: {
    fontSize: 17,
    fontFamily: 'Tajawal-Bold',
    lineHeight: 24,
    paddingTop: 2,
  },
  summaryMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  summaryCount: {
    fontSize: 13,
    fontFamily: 'Tajawal-Medium',
    lineHeight: 18,
  },
  clearBtn: {
    paddingHorizontal: 4,
  },
  clearText: {
    fontSize: 12,
    fontFamily: 'Tajawal-Medium',
    lineHeight: 16,
  },
  invoiceList: {
    gap: 10,
    marginTop: 6,
  },
  invoiceCard: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailsSide: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deviceTitle: {
    fontSize: 15,
    fontFamily: 'Tajawal-Bold',
    lineHeight: 22,
    paddingTop: 2,
  },
  newTag: {
    fontSize: 12,
    fontFamily: 'Tajawal-Bold',
  },
  cancelledBadge: {
    backgroundColor: '#B5533F',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  cancelledText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontFamily: 'Tajawal-Bold',
  },
  metaText: {
    fontSize: 12,
    fontFamily: 'Tajawal-Regular',
    marginTop: 4,
  },
  amountSide: {
    marginLeft: 14,
  },
  invoiceAmount: {
    fontSize: 16,
    fontFamily: 'Tajawal-Bold',
  },
});
