import React, { useCallback, useState } from 'react';
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
import { api, InvoiceItem, InvoiceSeriesItem } from '@/data/api';
import { TopBar } from '@/components/navigation/TopBar';
import { NeuView } from '@/components/neu/NeuView';
import { NeuSegmented } from '@/components/neu/NeuSegmented';
import { AnimatedNumber } from '@/components/neu/AnimatedNumber';
import { BarChart } from '@/components/charts/BarChart';
import { EmptyState } from '@/components/neu/EmptyState';

type RangeType = 'week' | 'month' | 'year';

export default function ReportsScreen() {
  const { colors } = useAppTheme();
  const [range, setRange] = useState<RangeType>('week');

  const [salesSeries, setSalesSeries] = useState<InvoiceSeriesItem[]>([]);
  const [purchasesSeries, setPurchasesSeries] = useState<InvoiceSeriesItem[]>([]);
  const [topSales, setTopSales] = useState<InvoiceItem[]>([]);

  const [totalSales, setTotalSales] = useState(0);
  const [totalPurchases, setTotalPurchases] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [sales, purchases, top] = await Promise.all([
        api.getInvoiceSeries('sale', range),
        api.getInvoiceSeries('purchase', range),
        api.getTopSalesInvoices(range, 3),
      ]);

      setSalesSeries(sales);
      setPurchasesSeries(purchases);
      setTopSales(top);

      // Sum values
      const sSum = sales.reduce((acc, curr) => acc + (curr.value || 0), 0);
      const pSum = purchases.reduce((acc, curr) => acc + (curr.value || 0), 0);

      setTotalSales(sSum);
      setTotalPurchases(pSum);
    } catch {
      // Ignore network errors
    } finally {
      setRefreshing(false);
    }
  }, [range]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <TopBar isRoot />

      {/* Header Row: Title «التقارير» + Period Segmented «أسبوع | شهر | سنة» */}
      <View style={styles.headerRow}>
        <Text style={[styles.pageTitle, { color: colors.text }]}>التقارير</Text>

        <View style={styles.segmentedWrapper}>
          <NeuSegmented
            compact
            options={[
              { value: 'week', label: 'أسبوع' },
              { value: 'month', label: 'شهر' },
              { value: 'year', label: 'سنة' },
            ]}
            value={range}
            onChange={(val) => setRange(val as RangeType)}
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
        {/* 1. Card: إجمالي المبيعات */}
        <NeuView variant="raised" radius={22} style={styles.summaryCard}>
          <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>
            إجمالي المبيعات
          </Text>
          <View style={styles.numberRow}>
            <AnimatedNumber
              value={totalSales}
              style={[styles.bigNumber, { color: colors.accent }]}
            />
            <Text style={[styles.currencySuffix, { color: colors.accent }]}>
              {' '}ج.م
            </Text>
          </View>
        </NeuView>

        {/* 2. Sales Chart */}
        <View style={styles.chartWrapper}>
          <BarChart data={salesSeries} height={145} mode={range} />
        </View>

        {/* 3. Card: إجمالي المشتريات */}
        <NeuView variant="raised" radius={22} style={styles.summaryCard}>
          <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>
            إجمالي المشتريات
          </Text>
          <View style={styles.numberRow}>
            <AnimatedNumber
              value={totalPurchases}
              style={[styles.bigNumber, { color: colors.accent }]}
            />
            <Text style={[styles.currencySuffix, { color: colors.accent }]}>
              {' '}ج.م
            </Text>
          </View>
        </NeuView>

        {/* 4. Purchases Chart */}
        <View style={styles.chartWrapper}>
          <BarChart data={purchasesSeries} height={145} mode={range} />
        </View>

        {/* 5. Section: الأعلى سعراً في البيع */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            الأعلى سعراً في البيع
          </Text>
        </View>

        {topSales.length === 0 ? (
          <EmptyState message="لا مبيعات في هذه الفترة" />
        ) : (
          <View style={styles.topList}>
            {topSales.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => router.push(`/invoice/${item.id}` as any)}
              >
                <NeuView variant="raised" radius={18} style={styles.invoiceCard}>
                  {/* Amount on trailing side */}
                  <View style={styles.amountSide}>
                    <Text style={[styles.invoiceAmount, { color: colors.text }]}>
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
                    </View>

                    <Text style={[styles.metaText, { color: colors.textMuted }]}>
                      {formatShortDate(item.created_at)} · {item.number}
                    </Text>
                  </View>
                </NeuView>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
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
    lineHeight: 32,
    paddingTop: 2,
  },
  segmentedWrapper: {
    width: 216,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 125,
  },
  summaryCard: {
    padding: 20,
    marginTop: 12,
    marginBottom: 8,
    width: '100%',
  },
  cardSubtitle: {
    fontSize: 13,
    fontFamily: 'Tajawal-Medium',
    lineHeight: 18,
    paddingTop: 1,
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 6,
  },
  bigNumber: {
    fontSize: 36,
    fontFamily: 'Tajawal-Bold',
  },
  currencySuffix: {
    fontSize: 18,
    fontFamily: 'Tajawal-Medium',
  },
  chartWrapper: {
    marginVertical: 4,
  },
  sectionHeader: {
    marginTop: 22,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: 'Tajawal-Bold',
  },
  topList: {
    gap: 10,
    marginTop: 4,
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
  },
  newTag: {
    fontSize: 12,
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
