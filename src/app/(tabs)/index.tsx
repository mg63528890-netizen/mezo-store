import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Pressable,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAppTheme } from '@/theme/ThemeContext';
import { formatCurrency, formatShortDate } from '@/utils/format';
import { api, DashboardStats, InvoiceSeriesItem } from '@/data/api';
import { supabase } from '@/data/supabase';
import { TopBar } from '@/components/navigation/TopBar';
import { NeuView } from '@/components/neu/NeuView';
import { AnimatedNumber } from '@/components/neu/AnimatedNumber';
import { BarChart } from '@/components/charts/BarChart';
import { EmptyState } from '@/components/neu/EmptyState';

export default function HomeScreen() {
  const { colors, isDark } = useAppTheme();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chartData, setChartData] = useState<InvoiceSeriesItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [dashStats, series] = await Promise.all([
        api.getDashboardStats(),
        api.getInvoiceSeries('sale', 'week'),
      ]);
      setStats(dashStats);
      setChartData(series);
    } catch {
      // Ignore network errors on refresh
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  useEffect(() => {
    // Realtime subscription to data_version
    const channel = supabase
      .channel('home_data_version_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'data_version' },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Calculate percentage vs yesterday
  let vsYesterdayText: string | null = null;
  if (stats && stats.yesterday_sales > 0 && stats.today_sales > 0) {
    const diff = stats.today_sales - stats.yesterday_sales;
    const pct = Math.round((diff / stats.yesterday_sales) * 100);
    const sign = pct >= 0 ? '+' : '';
    vsYesterdayText = `${sign}${pct}% مقارنة بالأمس`;
  }

  const todaySales = stats?.today_sales || 0;
  const todayInvoices = stats?.today_invoices_count || 0;
  const todayPurchases = stats?.today_purchases || 0;
  const recentInvoices = stats?.recent_invoices || [];

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <TopBar isRoot />

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
        {/* 1. Hero Card: مبيعات النهارده */}
        <NeuView variant="raised" radius={22} style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>
              مبيعات النهارده
            </Text>
            {vsYesterdayText ? (
              <Text style={[styles.vsYesterdayText, { color: colors.success }]}>
                {vsYesterdayText}
              </Text>
            ) : null}
          </View>

          <View style={styles.heroNumberRow}>
            <AnimatedNumber
              value={todaySales}
              style={[styles.heroNumber, { color: colors.accent }]}
            />
            <Text style={[styles.currencySuffix, { color: colors.accent }]}>
              {' '}ج.م
            </Text>
          </View>
        </NeuView>

        {/* 2. Informational Cards Row */}
        <View style={styles.cardsRow}>
          {/* Card: مشتريات النهارده */}
          <NeuView variant="raised" radius={20} style={styles.infoCard}>
            <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>
              مشتريات النهارده
            </Text>
            <View style={styles.infoNumberRow}>
              <AnimatedNumber
                value={todayPurchases}
                style={[styles.infoNumber, { color: colors.text }]}
              />
              <Text style={[styles.infoCurrency, { color: colors.textMuted }]}>
                {' '}ج.م
              </Text>
            </View>
          </NeuView>

          {/* Card: الفواتير */}
          <NeuView variant="raised" radius={20} style={styles.infoCard}>
            <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>
              الفواتير
            </Text>
            <View style={styles.infoNumberRow}>
              <AnimatedNumber
                value={todayInvoices}
                style={[styles.infoNumber, { color: colors.text }]}
              />
            </View>
          </NeuView>
        </View>

        {/* 3. Section: مبيعات آخر 7 أيام */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            مبيعات آخر 7 أيام
          </Text>
        </View>

        <BarChart data={chartData} height={145} />

        {/* 4. Section: آخر العمليات */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            آخر العمليات
          </Text>
        </View>

        {recentInvoices.length === 0 ? (
          <EmptyState message="لا توجد عمليات بعد" />
        ) : (
          <View style={styles.recentList}>
            {recentInvoices.map((item) => {
              const isSale = item.kind === 'sale';
              return (
                <Pressable
                  key={item.id}
                  onPress={() => router.push(`/invoice/${item.id}` as any)}
                >
                  <NeuView variant="raised" radius={18} style={styles.invoiceRow}>
                    {/* Amount on trailing side */}
                    <View style={styles.amountSide}>
                      <Text style={[styles.itemAmount, { color: colors.text }]}>
                        {formatCurrency(item.total)}
                      </Text>
                    </View>

                    {/* Details on leading side */}
                    <View style={styles.detailsSide}>
                      <View style={styles.topDetailRow}>
                        <View
                          style={[
                            styles.kindBadge,
                            {
                              backgroundColor: isSale
                                ? isDark
                                  ? '#2E281E'
                                  : '#F2ECE0'
                                : isDark
                                ? '#22262B'
                                : '#DEE1E6',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.kindBadgeText,
                              { color: isSale ? colors.accent : colors.textMuted },
                            ]}
                          >
                            {isSale ? 'بيع' : 'شراء'}
                          </Text>
                        </View>
                        <Text style={[styles.itemDevice, { color: colors.text }]}>
                          {item.device_type}
                        </Text>
                      </View>

                      <View style={styles.bottomDetailRow}>
                        {item.is_new_device ? (
                          <Text style={[styles.newDeviceTag, { color: colors.success }]}>
                            جديد ·{' '}
                          </Text>
                        ) : null}
                        <Text style={[styles.itemMeta, { color: colors.textMuted }]}>
                          {formatShortDate(item.created_at)} · {item.number}
                        </Text>
                      </View>
                    </View>
                  </NeuView>
                </Pressable>
              );
            })}
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
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 120, // Content scrolls behind floating tab bar
  },
  heroCard: {
    padding: 20,
    marginVertical: 8,
    width: '100%',
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  heroNumberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  heroNumber: {
    fontSize: 40,
    fontFamily: 'Tajawal-Bold',
  },
  currencySuffix: {
    fontSize: 20,
    fontFamily: 'Tajawal-Medium',
  },
  vsYesterdayText: {
    fontSize: 12,
    fontFamily: 'Tajawal-Medium',
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 6,
  },
  infoCard: {
    flex: 1,
    padding: 16,
    minHeight: 88,
    justifyContent: 'space-between',
  },
  cardSubtitle: {
    fontSize: 13,
    fontFamily: 'Tajawal-Medium',
    lineHeight: 19,
    paddingTop: 2,
  },
  infoNumberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 6,
  },
  infoNumber: {
    fontSize: 24,
    fontFamily: 'Tajawal-Bold',
  },
  infoCurrency: {
    fontSize: 13,
    fontFamily: 'Tajawal-Regular',
  },
  sectionHeader: {
    marginTop: 18,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: 'Tajawal-Bold',
    lineHeight: 25,
    paddingTop: 2,
  },
  recentList: {
    gap: 10,
    marginTop: 4,
  },
  invoiceRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailsSide: {
    flex: 1,
  },
  topDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kindBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  kindBadgeText: {
    fontSize: 11,
    fontFamily: 'Tajawal-Bold',
  },
  itemDevice: {
    fontSize: 14,
    fontFamily: 'Tajawal-Bold',
  },
  bottomDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  newDeviceTag: {
    fontSize: 11,
    fontFamily: 'Tajawal-Bold',
  },
  itemMeta: {
    fontSize: 12,
    fontFamily: 'Tajawal-Regular',
  },
  amountSide: {
    marginLeft: 12,
  },
  itemAmount: {
    fontSize: 15,
    fontFamily: 'Tajawal-Bold',
  },
});
