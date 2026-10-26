import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
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
import { useAuth } from '@/auth/AuthContext';

export default function NewPurchaseScreen() {
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
  const [partyPhone, setPartyPhone] = useState(''); // Seller phone on purchases
  const [taxPeriod, setTaxPeriod] = useState('');
  const [price, setPrice] = useState('');

  // Confirmation Bottom Sheet State
  const [sheetVisible, setSheetVisible] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState('');
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

  const handleConfirmPurchase = async () => {
    setSaving(true);
    try {
      const payload: CreateInvoicePayload = {
        idempotency_key: idempotencyKey,
        kind: 'purchase',
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
      };

      const created = await api.createInvoice(payload);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      notificationService.notifyInvoiceCreated({
        id: created.id,
        number: created.number,
        kind: 'purchase',
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

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <TopBar isRoot={false} title="فاتورة شراء" />

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

          {/* Form Fields (§8.2.2 Exact order) */}
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
            placeholder="اسم البائع"
          />

          {/* 9. رقم تليفون البائع (اختياري) (§8.2.2) */}
          <NeuInput
            label="رقم تليفون البائع (اختياري)"
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

      {/* Floating Add Invoice Bar (§8.2.2) */}
      <AddInvoiceBar
        title="إضافة الفاتورة"
        onPress={handleOpenConfirmSheet}
        disabled={!isFormValid}
      />

      {/* Purchase Confirmation Bottom Sheet (§8.2.2: Total card only + Confirm button) */}
      <NeuSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        title="تأكيد الشراء"
      >
        <View style={styles.sheetContent}>
          {/* Single Total Card */}
          <View
            style={[
              styles.totalCard,
              {
                backgroundColor: colors.bg,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                borderWidth: 1,
                borderRadius: 18,
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
            <Text style={[styles.totalCardLabel, { color: colors.textMuted }]}>
              الإجمالي
            </Text>
            <Text style={[styles.totalCardValue, { color: colors.accent }]}>
              {formatCurrency(parsedPrice || 0)}
            </Text>
          </View>

          {/* Confirm Button (§8.2.2: Saves immediately, no 2nd dialog) */}
          <NeuButton
            title="تأكيد الشراء"
            variant="gold"
            onPress={handleConfirmPurchase}
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
    paddingBottom: 130,
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
    paddingVertical: 12,
    gap: 16,
  },
  totalCard: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  totalCardLabel: {
    fontSize: 14,
    fontFamily: 'Tajawal-Medium',
  },
  totalCardValue: {
    fontSize: 28,
    fontFamily: 'Tajawal-Bold',
  },
  confirmButton: {
    width: '100%',
    marginTop: 8,
  },
});
