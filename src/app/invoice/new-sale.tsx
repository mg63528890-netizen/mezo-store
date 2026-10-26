import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Keyboard,
  TouchableWithoutFeedback,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { X } from 'lucide-react-native';
import { useAppTheme } from '@/theme/ThemeContext';
import { formatCurrency, convertArabicIndicDigits } from '@/utils/format';
import { api, CreateInvoicePayload } from '@/data/api';
import { TopBar } from '@/components/navigation/TopBar';
import { AddInvoiceBar } from '@/components/navigation/AddInvoiceBar';
import { notificationService } from '@/utils/notifications';
import { NeuView } from '@/components/neu/NeuView';
import { NeuInput } from '@/components/neu/NeuInput';
import { NeuSwitch } from '@/components/neu/NeuSwitch';
import { NeuSheet } from '@/components/neu/NeuSheet';
import { NeuButton } from '@/components/neu/NeuButton';
import { NeuDropdown } from '@/components/neu/NeuDropdown';
import { useAuth } from '@/auth/AuthContext';

export default function NewSaleScreen() {
  const { colors, isDark } = useAppTheme();
  const { logout } = useAuth();

  // Form State
  const [isNewDevice, setIsNewDevice] = useState(false);
  const [deviceType, setDeviceType] = useState('');
  const [batteryPct, setBatteryPct] = useState('');
  const [storageGb, setStorageGb] = useState('');
  const [deviceNumber, setDeviceNumber] = useState('');
  const [conditionNotes, setConditionNotes] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [sellerName, setSellerName] = useState('');
  const [partyPhone, setPartyPhone] = useState('');
  const [taxPeriod, setTaxPeriod] = useState('');
  const [price, setPrice] = useState('');

  // Confirmation Bottom Sheet State
  const [sheetVisible, setSheetVisible] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [discountCode, setDiscountCode] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [appliedDiscountCode, setAppliedDiscountCode] = useState<string | null>(null);
  const [discountLoading, setDiscountLoading] = useState(false);
  const [discountError, setDiscountError] = useState<string | null>(null);

  // Warranty State
  const [warrantyUnit, setWarrantyUnit] = useState<'none' | 'days' | 'months'>('none');
  const [warrantyValue, setWarrantyValue] = useState('');

  const [saving, setSaving] = useState(false);

  // Handle New Device Toggle
  const handleToggleNewDevice = (val: boolean) => {
    setIsNewDevice(val);
    if (val) {
      setBatteryPct('100');
      setConditionNotes('كرتونة متبرشمة');
      setTaxPeriod('كاملة');
    } else {
      setBatteryPct('');
      setConditionNotes('');
      setTaxPeriod('');
    }
  };

  // Validation
  const parsedBattery = parseInt(batteryPct, 10);
  const isBatteryValid =
    !isNaN(parsedBattery) && parsedBattery >= 0 && parsedBattery <= 100;

  const parsedStorage = parseInt(storageGb, 10);
  const isStorageValid = !isNaN(parsedStorage) && parsedStorage > 0;

  const parsedPrice = parseFloat(price);
  const isPriceValid = !isNaN(parsedPrice) && parsedPrice > 0;

  const isFormValid =
    deviceType.trim().length >= 2 &&
    isBatteryValid &&
    isStorageValid &&
    deviceNumber.trim().length >= 5 &&
    buyerName.trim().length >= 2 &&
    sellerName.trim().length >= 2 &&
    taxPeriod.trim().length > 0 &&
    isPriceValid;

  const handleOpenConfirmSheet = () => {
    if (!isFormValid) return;
    // Generate UUID for idempotency
    const uuid =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });
    setIdempotencyKey(uuid);
    setSheetVisible(true);
  };

  const getLocalizedDiscountError = (raw: string): string => {
    const msg = (raw || '').toUpperCase();
    if (msg.includes('DISCOUNT_INVALID') || msg.includes('INVALID') || msg.includes('NOT_FOUND')) {
      return 'كود الخصم غير صحيح أو غير موجود';
    }
    if (msg.includes('DISCOUNT_EXPIRED') || msg.includes('EXPIRED')) {
      return 'انتهت صلاحية هذا الكود';
    }
    if (msg.includes('DISCOUNT_EXHAUSTED') || msg.includes('EXHAUSTED') || msg.includes('LIMIT')) {
      return 'تم استنفاد الحد الأقصى لاستخدام هذا الكود';
    }
    if (msg.includes('PRICE') || msg.includes('MINIMUM')) {
      return 'قيمة الفاتورة لا تكفي لتطبيق هذا الخصم';
    }
    return 'كود الخصم غير صالح أو تعذر تطبيقه';
  };

  const handleApplyDiscount = async () => {
    if (!discountCode.trim()) return;
    setDiscountLoading(true);
    setDiscountError(null);
    try {
      const res = await api.validateDiscount(discountCode.trim(), parsedPrice);
      if (res.valid) {
        setDiscountAmount(res.discount_amount);
        setAppliedDiscountCode(discountCode.trim().toUpperCase());
        setDiscountCode('');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else {
        setDiscountError(getLocalizedDiscountError(res.message || ''));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
    } catch (e: any) {
      setDiscountError(getLocalizedDiscountError(e?.message || ''));
    } finally {
      setDiscountLoading(false);
    }
  };

  const handleRemoveDiscount = () => {
    setAppliedDiscountCode(null);
    setDiscountAmount(0);
    setDiscountError(null);
  };

  const handleConfirmSale = async () => {
    setSaving(true);
    try {
      const payload: CreateInvoicePayload = {
        idempotency_key: idempotencyKey,
        kind: 'sale',
        device_type: deviceType.trim(),
        battery_pct: parsedBattery,
        storage_gb: parsedStorage,
        device_number: deviceNumber.trim(),
        condition_notes: conditionNotes.trim() || null,
        is_new_device: isNewDevice,
        tax_period: taxPeriod.trim(),
        buyer_name: buyerName.trim(),
        seller_name: sellerName.trim(),
        party_phone: partyPhone.trim() || null,
        price: parsedPrice,
        discount_code: appliedDiscountCode,
        warranty_unit: warrantyUnit,
        warranty_value:
          warrantyUnit !== 'none' && warrantyValue
            ? parseInt(warrantyValue, 10)
            : null,
      };

      const created = await api.createInvoice(payload);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      notificationService.notifyInvoiceCreated({
        id: created.id,
        number: created.number,
        kind: 'sale',
        total: created.total,
        device_type: created.device_type,
      }).catch(() => {});
      setSheetVisible(false);
      // Navigate to invoice details immediately
      router.replace(`/invoice/${created.id}` as any);
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      const rawMsg = e?.message || '';
      if (rawMsg.includes('DEVICE_NOT_REGISTERED')) {
        Alert.alert(
          'تنبيه الجهاز',
          'هذا الجهاز غير مسجل أو انتهت صلاحية الجلسة. يرجى إعادة تسجيل الدخول لتفعيل الجهاز.',
          [
            {
              text: 'إعادة تسجيل الدخول',
              onPress: () => {
                setSheetVisible(false);
                logout();
              },
            },
            { text: 'إلغاء', style: 'cancel' },
          ]
        );
      } else {
        Alert.alert(
          'خطأ',
          rawMsg || 'حدث خطأ أثناء حفظ الفاتورة',
          [{ text: 'حسناً' }]
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const currentTotal = Math.max(0, (parsedPrice || 0) - discountAmount);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <TopBar isRoot={false} title="فاتورة بيع" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.formInner}>
          {/* 1. Brand-New Device Switch Row (§8.2.3: No helper text) */}
          <NeuView variant="raised" radius={18} style={styles.switchCard}>
            <Text style={[styles.switchTitle, { color: colors.text }]}>
              جهاز جديد
            </Text>
            <NeuSwitch
              value={isNewDevice}
              onValueChange={handleToggleNewDevice}
            />
          </NeuView>

          {/* Form Fields (§8.2.1 Exact order) */}
          {/* 2. نوع الجهاز */}
          <NeuInput
            label="نوع الجهاز"
            value={deviceType}
            onChangeText={setDeviceType}
            placeholder="مثال: iPhone 15 Pro Max"
          />

          {/* 3. نسبة البطارية */}
          <NeuInput
            label="نسبة البطارية"
            value={batteryPct}
            onChangeText={(txt) => setBatteryPct(convertArabicIndicDigits(txt))}
            keyboardType="number-pad"
            placeholder="100"
            editable={!isNewDevice}
          />

          {/* 4. مساحة التخزين */}
          <NeuInput
            label="مساحة التخزين (جيجا)"
            value={storageGb}
            onChangeText={(txt) => setStorageGb(convertArabicIndicDigits(txt))}
            keyboardType="number-pad"
            placeholder="256"
          />

          {/* 5. رقم الجهاز (IMEI / Serial) */}
          <NeuInput
            label="رقم الجهاز"
            value={deviceNumber}
            onChangeText={(txt) => setDeviceNumber(convertArabicIndicDigits(txt))}
            placeholder="IMEI أو الرقم التسلسلي"
            autoCapitalize="characters"
          />

          {/* 6. حالة وملاحظات الجهاز (اختياري) */}
          <NeuInput
            label="حالة وملاحظات الجهاز (اختياري)"
            value={conditionNotes}
            onChangeText={setConditionNotes}
            placeholder="حالة الجهاز وملاحظات الفحص"
            editable={!isNewDevice}
          />

          {/* 7. اسم المشتري */}
          <NeuInput
            label="اسم المشتري"
            value={buyerName}
            onChangeText={setBuyerName}
            placeholder="الاسم ثلاثي"
          />

          {/* 8. اسم البائع */}
          <NeuInput
            label="اسم البائع"
            value={sellerName}
            onChangeText={setSellerName}
            placeholder="اسم البائع المسؤول"
          />

          {/* 9. رقم تليفون المشتري (اختياري) */}
          <NeuInput
            label="رقم تليفون المشتري (اختياري)"
            value={partyPhone}
            onChangeText={(txt) => setPartyPhone(convertArabicIndicDigits(txt))}
            keyboardType="phone-pad"
            placeholder="01xxxxxxxxx"
          />

          {/* 10. مدة الضريبة */}
          <NeuInput
            label="مدة الضريبة"
            value={taxPeriod}
            onChangeText={setTaxPeriod}
            placeholder="مثال: كاملة أو سنة"
            editable={!isNewDevice}
          />

          {/* 11. السعر */}
          <NeuInput
            label="السعر"
            value={price}
            onChangeText={(txt) => setPrice(convertArabicIndicDigits(txt))}
            keyboardType="decimal-pad"
            placeholder="0"
          />
            </View>
          </TouchableWithoutFeedback>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Floating Add Invoice Bar (§8.2.1) */}
      <AddInvoiceBar
        title="إضافة الفاتورة"
        onPress={handleOpenConfirmSheet}
        disabled={!isFormValid}
      />

      {/* Sale Confirmation Bottom Sheet (§8.2.1) */}
      <NeuSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        title="تأكيد البيع"
      >
        <View style={styles.sheetContent}>
          {/* Discount Section */}
          <View style={styles.discountSection}>
            <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
              كود الخصم
            </Text>
            {appliedDiscountCode ? (
              <View style={styles.appliedCodeRow}>
                <View
                  style={[
                    styles.codeChip,
                    {
                      backgroundColor: colors.bg,
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                    },
                  ]}
                >
                  <Text style={[styles.codeChipText, { color: colors.accent }]}>
                    {appliedDiscountCode} (-{formatCurrency(discountAmount)})
                  </Text>
                  <Pressable onPress={handleRemoveDiscount} style={styles.removeChipBtn}>
                    <X size={14} color={colors.danger} />
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.discountInputRow}>
                <NeuInput
                  value={discountCode}
                  onChangeText={(txt) => {
                    setDiscountCode(txt);
                    if (discountError) setDiscountError(null);
                  }}
                  placeholder="أدخل كود الخصم"
                  autoCapitalize="characters"
                  containerStyle={styles.discountField}
                />
                <NeuButton
                  title="تطبيق"
                  variant="gold"
                  height={44}
                  radius={14}
                  onPress={handleApplyDiscount}
                  loading={discountLoading}
                  disabled={!discountCode.trim() || discountLoading}
                  style={styles.applyBtn}
                  textStyle={styles.applyBtnText}
                />
              </View>
            )}
            {discountError ? (
              <Text style={[styles.errorText, { color: colors.danger }]}>
                {discountError}
              </Text>
            ) : null}
          </View>

          {/* Warranty Section */}
          <View style={styles.warrantySection}>
            <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
              مدة الضمان
            </Text>
            <View style={styles.warrantyRow}>
              <View style={styles.dropdownWrap}>
                <NeuDropdown
                  options={[
                    { value: 'none', label: 'بدون' },
                    { value: 'days', label: 'أيام' },
                    { value: 'months', label: 'أشهر' },
                  ]}
                  selectedValue={warrantyUnit}
                  onSelect={(val) => setWarrantyUnit(val)}
                />
              </View>

              {warrantyUnit !== 'none' ? (
                <View style={styles.warrantyValueWrap}>
                  <NeuInput
                    value={warrantyValue}
                    onChangeText={(txt) => setWarrantyValue(convertArabicIndicDigits(txt))}
                    keyboardType="number-pad"
                    placeholder="المدة"
                  />
                </View>
              ) : null}
            </View>
          </View>

          {/* Summary Card */}
          <View
            style={[
              styles.summaryCard,
              {
                backgroundColor: colors.bg,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                borderWidth: 1,
                boxShadow: [
                  {
                    offsetX: 0,
                    offsetY: 2,
                    blurRadius: 8,
                    color: isDark ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.05)',
                  },
                ],
              },
            ]}
          >
            <View style={styles.summaryLine}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
                المجموع
              </Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {formatCurrency(parsedPrice || 0)}
              </Text>
            </View>

            {discountAmount > 0 ? (
              <View style={styles.summaryLine}>
                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
                  الخصم
                </Text>
                <Text style={[styles.summaryValue, { color: colors.danger }]}>
                  -{formatCurrency(discountAmount)}
                </Text>
              </View>
            ) : null}

            <View style={[styles.summaryLine, styles.totalLine]}>
              <Text style={[styles.totalLabel, { color: colors.text }]}>
                الإجمالي
              </Text>
              <Text style={[styles.totalValue, { color: colors.accent }]}>
                {formatCurrency(currentTotal)}
              </Text>
            </View>
          </View>

          {/* Confirm Button (§8.2.1 / §8.2.4: Creates immediately, no 2nd dialog) */}
          <NeuButton
            title="تأكيد البيع"
            variant="gold"
            onPress={handleConfirmSale}
            loading={saving}
            disabled={saving}
            style={styles.confirmButton}
          />
        </View>
      </NeuSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 130, // Content scrolls comfortably above bar and keyboard
  },
  formInner: {
    gap: 12,
  },
  switchCard: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
  },
  switchTitle: {
    fontSize: 16,
    fontFamily: 'Tajawal-Bold',
  },
  sheetContent: {
    paddingVertical: 8,
    gap: 16,
  },
  discountSection: {
    gap: 6,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontFamily: 'Tajawal-Medium',
  },
  discountInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    width: '100%',
  },
  discountField: {
    flex: 1,
    marginVertical: 0,
  },
  applyBtn: {
    width: 78,
  },
  applyBtnText: {
    fontSize: 14,
    fontFamily: 'Tajawal-Bold',
  },
  appliedCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  codeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  codeChipText: {
    fontSize: 13,
    fontFamily: 'Tajawal-Bold',
  },
  removeChipBtn: {
    padding: 2,
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'Tajawal-Medium',
    marginTop: 2,
  },
  warrantySection: {
    gap: 6,
  },
  warrantyRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  dropdownWrap: {
    flex: 1,
  },
  warrantyValueWrap: {
    width: 100,
  },
  summaryCard: {
    padding: 16,
    gap: 10,
  },
  summaryLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 13,
    fontFamily: 'Tajawal-Medium',
  },
  summaryValue: {
    fontSize: 14,
    fontFamily: 'Tajawal-Bold',
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
  totalValue: {
    fontSize: 18,
    fontFamily: 'Tajawal-Bold',
  },
  confirmButton: {
    width: '100%',
    marginTop: 8,
  },
});
