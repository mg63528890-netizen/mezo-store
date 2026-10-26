import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Lock } from 'lucide-react-native';
import { useAppTheme } from '@/theme/ThemeContext';
import { formatCurrency, formatShortDate } from '@/utils/format';
import { api, InvoiceItem } from '@/data/api';
import { TopBar } from '@/components/navigation/TopBar';
import { NeuView } from '@/components/neu/NeuView';
import { NeuButton } from '@/components/neu/NeuButton';
import { NeuDialog } from '@/components/neu/NeuDialog';
import { exportInvoicePdf, printInvoiceDirect } from '@/utils/pdf';
import { printerService } from '@/utils/printer';
import { notificationService } from '@/utils/notifications';

export default function InvoiceDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, isDark } = useAppTheme();

  const [invoice, setInvoice] = useState<InvoiceItem | null>(null);
  const [isEditable, setIsEditable] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [cancelDialogVisible, setCancelDialogVisible] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Print & PDF Loading
  const [printing, setPrinting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const loadInvoice = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.getInvoice(id);
      setInvoice(data.invoice);
      setIsEditable(data.is_editable);
      setRemainingSeconds(data.remaining_seconds);
    } catch (e: any) {
      Alert.alert('خطأ', e.message || 'تعذر تحميل بيانات الفاتورة');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadInvoice();
    }, [loadInvoice])
  );

  // Format countdown string
  const formatCountdown = (secs: number) => {
    if (secs <= 0) return 'انتهت المهلة';
    const hours = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      const remHours = hours % 24;
      return `${days} يوم و ${remHours} ساعة`;
    }
    return `${hours} ساعة و ${mins} دقيقة`;
  };

  const handlePrint = async () => {
    if (!invoice) return;
    setPrinting(true);
    try {
      const res = await printerService.printInvoice(invoice);
      if (res.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        notificationService.notifyInvoicePrinted(invoice.number, invoice.id).catch(() => {});
        Alert.alert('نجاح', 'تم إرسال أمر الطباعة بنجاح إلى الطابعة');
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        Alert.alert(
          'فشل الاتصال بالطابعة',
          `${res.message}\n\nهل تريد الطباعة عبر طابعة النظام اللاسلكية (AirPrint)؟`,
          [
            { text: 'إلغاء', style: 'cancel' },
            {
              text: 'طباعة عبر AirPrint',
              onPress: async () => {
                try {
                  await printInvoiceDirect(invoice);
                  notificationService.notifyInvoicePrinted(invoice.number, invoice.id).catch(() => {});
                } catch (err: any) {
                  Alert.alert('خطأ', err.message || 'تعذر الطباعة');
                }
              },
            },
          ]
        );
      }
    } catch (e: any) {
      Alert.alert('خطأ في الطباعة', e.message || 'حدث خطأ غير متوقع أثناء الطباعة');
    } finally {
      setPrinting(false);
    }
  };

  const handleExportPdf = async () => {
    if (!invoice) return;
    setExportingPdf(true);
    try {
      await exportInvoicePdf(invoice);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      notificationService.notifyInvoiceExported(invoice.number, invoice.id).catch(() => {});
    } catch (e: any) {
      Alert.alert('خطأ في تصدير PDF', e.message);
    } finally {
      setExportingPdf(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!invoice) return;
    setActionLoading(true);
    try {
      const updated = await api.cancelInvoice(invoice.id);
      setInvoice(updated);
      setIsEditable(false);
      setCancelDialogVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      notificationService.notifyInvoiceCancelled(invoice.number, invoice.id).catch(() => {});
    } catch (e: any) {
      Alert.alert('خطأ', e.message || 'تعذر إلغاء الفاتورة');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!invoice) return;
    setActionLoading(true);
    try {
      await api.deleteInvoice(invoice.id);
      setDeleteDialogVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      notificationService.notifyInvoiceDeleted(invoice.number).catch(() => {});
      router.back();
    } catch (e: any) {
      Alert.alert('خطأ', e.message || 'تعذر حذف الفاتورة');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!invoice) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.bg }]}>
        <TopBar isRoot={false} title="الفاتورة" />
        <Text style={[styles.notFoundText, { color: colors.textMuted }]}>
          الفاتورة غير موجودة
        </Text>
      </View>
    );
  }

  const isSale = invoice.kind === 'sale';
  const isCancelled = invoice.status === 'cancelled';

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <TopBar isRoot={false} title={invoice.number} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header Summary Banner */}
        <NeuView variant="raised" radius={20} style={styles.bannerCard}>
          <View style={styles.bannerTopRow}>
            <View style={styles.badgesWrap}>
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
                  {isSale ? 'فاتورة بيع' : 'فاتورة شراء'}
                </Text>
              </View>

              {invoice.is_new_device ? (
                <View style={[styles.newBadge, { backgroundColor: colors.success }]}>
                  <Text style={styles.newBadgeText}>جديد بالكامل</Text>
                </View>
              ) : null}

              {isCancelled ? (
                <View style={[styles.cancelledBadge, { backgroundColor: colors.danger }]}>
                  <Text style={styles.cancelledBadgeText}>ملغاة</Text>
                </View>
              ) : null}
            </View>

            <Text style={[styles.dateText, { color: colors.textMuted }]}>
              {formatShortDate(invoice.created_at)}
            </Text>
          </View>

          <View style={styles.bannerPriceRow}>
            <Text
              style={[
                styles.totalPrice,
                {
                  color: isCancelled ? colors.textMuted : colors.accent,
                  textDecorationLine: isCancelled ? 'line-through' : 'none',
                },
              ]}
            >
              {formatCurrency(invoice.total)}
            </Text>
          </View>

          {/* Edit window countdown or lock notice (§8.3 / screen 28) */}
          {!isCancelled && (
            <View style={styles.windowNoticeRow}>
              {isEditable ? (
                <Text style={[styles.windowNoticeText, { color: colors.textMuted }]}>
                  متبقي على إمكانية التعديل والإلغاء: {formatCountdown(remainingSeconds)}
                </Text>
              ) : (
                <View style={styles.lockedRow}>
                  <Lock size={13} color={colors.textMuted} />
                  <Text style={[styles.windowNoticeText, { color: colors.textMuted }]}>
                    انتهت مهلة التعديل والإلغاء
                  </Text>
                </View>
              )}
            </View>
          )}
        </NeuView>

        {/* Primary Actions (Print & Export PDF) */}
        <View style={styles.actionsRow}>
          <NeuButton
            title="طباعة"
            variant="secondary"
            onPress={handlePrint}
            loading={printing}
            style={styles.actionBtn}
          />
          <NeuButton
            title="تصدير PDF"
            variant="gold"
            onPress={handleExportPdf}
            loading={exportingPdf}
            style={styles.actionBtn}
          />
        </View>

        {/* Device Information Card */}
        <NeuView variant="raised" radius={18} style={styles.infoSection}>
          <Text style={[styles.sectionTitle, { color: colors.accent }]}>
            بيانات الجهاز
          </Text>

          <View style={styles.infoGrid}>
            <View style={styles.infoCol}>
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
                نوع الجهاز
              </Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {invoice.device_type}
              </Text>
            </View>

            <View style={styles.infoCol}>
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
                الرقم التسلسلي / IMEI
              </Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {invoice.device_number}
              </Text>
            </View>

            <View style={styles.infoCol}>
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
                نسبة البطارية
              </Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {invoice.battery_pct}%
              </Text>
            </View>

            <View style={styles.infoCol}>
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
                مساحة التخزين
              </Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {invoice.storage_gb} جيجا
              </Text>
            </View>

            <View style={styles.infoCol}>
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
                مدة الضريبة
              </Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {invoice.tax_period}
              </Text>
            </View>

            {isSale && (
              <View style={styles.infoCol}>
                <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
                  مدة الضمان
                </Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {invoice.warranty_unit && invoice.warranty_unit !== 'none'
                    ? `${invoice.warranty_value} ${
                        invoice.warranty_unit === 'months' ? 'أشهر' : 'أيام'
                      }`
                    : 'بدون ضمان'}
                </Text>
              </View>
            )}
          </View>

          {invoice.condition_notes ? (
            <View style={styles.notesWrap}>
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
                حالة وملاحظات الجهاز
              </Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {invoice.condition_notes}
              </Text>
            </View>
          ) : null}
        </NeuView>

        {/* Parties Card */}
        <NeuView variant="raised" radius={18} style={styles.infoSection}>
          <Text style={[styles.sectionTitle, { color: colors.accent }]}>
            بيانات الأطراف
          </Text>

          <View style={styles.infoGrid}>
            <View style={styles.infoCol}>
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
                اسم المشتري
              </Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {invoice.buyer_name}
              </Text>
            </View>

            <View style={styles.infoCol}>
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
                اسم البائع
              </Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {invoice.seller_name}
              </Text>
            </View>

            {invoice.party_phone ? (
              <View style={styles.infoCol}>
                <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
                  {isSale ? 'رقم تليفون المشتري' : 'رقم تليفون البائع'}
                </Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {invoice.party_phone}
                </Text>
              </View>
            ) : null}
          </View>
        </NeuView>

        {/* Financial Details Card */}
        <NeuView variant="raised" radius={18} style={styles.infoSection}>
          <Text style={[styles.sectionTitle, { color: colors.accent }]}>
            التفاصيل المالية
          </Text>

          <View style={styles.financeLine}>
            <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
              السعر
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {formatCurrency(invoice.price)}
            </Text>
          </View>

          {isSale && Number(invoice.discount_amount) > 0 ? (
            <View style={styles.financeLine}>
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
                {invoice.discount_code ? `الخصم (${invoice.discount_code})` : 'الخصم'}
              </Text>
              <Text style={[styles.infoValue, { color: colors.danger }]}>
                -{formatCurrency(invoice.discount_amount)}
              </Text>
            </View>
          ) : null}

          <View style={[styles.financeLine, styles.totalLine]}>
            <Text style={[styles.totalLabel, { color: colors.text }]}>
              الإجمالي النهائي
            </Text>
            <Text style={[styles.totalAmount, { color: colors.accent }]}>
              {formatCurrency(invoice.total)}
            </Text>
          </View>
        </NeuView>

        {/* Edit / Cancel / Delete Action Buttons (Only when isEditable && active) */}
        {isEditable && !isCancelled && (
          <View style={styles.manageButtonsWrap}>
            <NeuButton
              title="تعديل الفاتورة"
              variant="secondary"
              onPress={() => router.push(`/invoice/edit/${invoice.id}` as any)}
              style={styles.manageBtn}
            />

            {isSale ? (
              <NeuButton
                title="إلغاء الفاتورة"
                variant="danger"
                onPress={() => setCancelDialogVisible(true)}
                style={styles.manageBtn}
              />
            ) : (
              <NeuButton
                title="حذف الفاتورة"
                variant="danger"
                onPress={() => setDeleteDialogVisible(true)}
                style={styles.manageBtn}
              />
            )}
          </View>
        )}
      </ScrollView>

      {/* Cancel Sale Invoice Dialog (screen 25) */}
      <NeuDialog
        visible={cancelDialogVisible}
        onClose={() => setCancelDialogVisible(false)}
        title="إلغاء الفاتورة"
        message="هل تريد بالتأكيد إلغاء الفاتورة؟ ستبقى مسجلة كفاتورة ملغاة ولن تحسب في الإحصائيات."
        confirmText="تأكيد الإلغاء"
        cancelText="تراجع"
        onConfirm={handleConfirmCancel}
        variant="danger"
        loading={actionLoading}
      />

      {/* Delete Purchase Invoice Dialog */}
      <NeuDialog
        visible={deleteDialogVisible}
        onClose={() => setDeleteDialogVisible(false)}
        title="حذف الفاتورة"
        message="هل تريد بالتأكيد حذف هذه الفاتورة؟ سيتم حذفها نهائياً ولن تظهر في السجل."
        confirmText="تأكيد الحذف"
        cancelText="تراجع"
        onConfirm={handleConfirmDelete}
        variant="danger"
        loading={actionLoading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundText: {
    fontSize: 16,
    fontFamily: 'Tajawal-Medium',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 40,
    gap: 14,
  },
  bannerCard: {
    padding: 20,
    gap: 12,
  },
  bannerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgesWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kindBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  kindBadgeText: {
    fontSize: 12,
    fontFamily: 'Tajawal-Bold',
  },
  newBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  newBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'Tajawal-Bold',
  },
  cancelledBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  cancelledBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'Tajawal-Bold',
  },
  dateText: {
    fontSize: 12,
    fontFamily: 'Tajawal-Regular',
  },
  bannerPriceRow: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  totalPrice: {
    fontSize: 34,
    fontFamily: 'Tajawal-Bold',
  },
  windowNoticeRow: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
    paddingTop: 10,
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  windowNoticeText: {
    fontSize: 12,
    fontFamily: 'Tajawal-Medium',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
  },
  infoSection: {
    padding: 18,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'Tajawal-Bold',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)',
    paddingBottom: 8,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  infoCol: {
    width: '46%',
  },
  infoLabel: {
    fontSize: 12,
    fontFamily: 'Tajawal-Medium',
  },
  infoValue: {
    fontSize: 14,
    fontFamily: 'Tajawal-Bold',
    marginTop: 2,
  },
  notesWrap: {
    marginTop: 4,
  },
  financeLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLine: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
    paddingTop: 10,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 15,
    fontFamily: 'Tajawal-Bold',
  },
  totalAmount: {
    fontSize: 20,
    fontFamily: 'Tajawal-Bold',
  },
  manageButtonsWrap: {
    gap: 10,
    marginTop: 6,
  },
  manageBtn: {
    width: '100%',
  },
});
