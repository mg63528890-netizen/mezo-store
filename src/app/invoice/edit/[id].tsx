import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '@/theme/ThemeContext';
import { convertArabicIndicDigits } from '@/utils/format';
import { api, InvoiceItem, CreateInvoicePayload } from '@/data/api';
import { TopBar } from '@/components/navigation/TopBar';
import { AddInvoiceBar } from '@/components/navigation/AddInvoiceBar';
import { notificationService } from '@/utils/notifications';
import { NeuView } from '@/components/neu/NeuView';
import { NeuInput } from '@/components/neu/NeuInput';
import { NeuSwitch } from '@/components/neu/NeuSwitch';
import { NeuDropdown } from '@/components/neu/NeuDropdown';

export default function EditInvoiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useAppTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [originalInvoice, setOriginalInvoice] = useState<InvoiceItem | null>(null);

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

  // Discount & Warranty (for sales)
  const [discountCode, setDiscountCode] = useState('');
  const [warrantyUnit, setWarrantyUnit] = useState<'none' | 'days' | 'months'>('none');
  const [warrantyValue, setWarrantyValue] = useState('');

  useEffect(() => {
    if (!id) return;
    api.getInvoice(id)
      .then((data) => {
        const inv = data.invoice;
        setOriginalInvoice(inv);
        setIsNewDevice(inv.is_new_device);
        setDeviceType(inv.device_type);
        setBatteryPct(String(inv.battery_pct));
        setStorageGb(String(inv.storage_gb));
        setDeviceNumber(inv.device_number);
        setConditionNotes(inv.condition_notes || '');
        setBuyerName(inv.buyer_name);
        setSellerName(inv.seller_name);
        setPartyPhone(inv.party_phone || '');
        setTaxPeriod(inv.tax_period);
        setPrice(String(inv.price));
        setDiscountCode(inv.discount_code || '');
        setWarrantyUnit(inv.warranty_unit || 'none');
        setWarrantyValue(inv.warranty_value ? String(inv.warranty_value) : '');
      })
      .catch((e) => {
        Alert.alert('خطأ', e.message || 'تعذر تحميل بيانات الفاتورة');
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Handle New Device Toggle
  const handleToggleNewDevice = (val: boolean) => {
    setIsNewDevice(val);
    if (val) {
      setBatteryPct('100');
      setConditionNotes('كرتونة متبرشمة');
      setTaxPeriod('كاملة');
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

  const handleSave = async () => {
    if (!id || !originalInvoice) return;
    setSaving(true);
    try {
      const payload: Partial<CreateInvoicePayload> = {
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
        discount_code: discountCode.trim() || null,
        warranty_unit: warrantyUnit,
        warranty_value:
          warrantyUnit !== 'none' && warrantyValue
            ? parseInt(warrantyValue, 10)
            : null,
      };

      await api.updateInvoice(id, payload);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      notificationService.notifyInvoiceUpdated(originalInvoice.number, originalInvoice.id).catch(() => {});
      router.back();
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      const rawMsg = e?.message || '';
      if (rawMsg.includes('DEVICE_NOT_REGISTERED')) {
        Alert.alert(
          'تنبيه الجهاز',
          'هذا الجهاز غير مسجل أو انتهت صلاحية الجلسة. يرجى إعادة تسجيل الدخول لتفعيل الجهاز.',
          [{ text: 'حسناً' }]
        );
      } else {
        Alert.alert('خطأ في التعديل', rawMsg || 'تعذر حفظ التعديلات', [{ text: 'حسناً' }]);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const isSale = originalInvoice?.kind === 'sale';

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <TopBar isRoot={false} title="تعديل الفاتورة" />

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
          {/* Brand-New Device Switch */}
          <NeuView variant="raised" radius={18} style={styles.switchCard}>
            <Text style={[styles.switchTitle, { color: colors.text }]}>
              جهاز جديد
            </Text>
            <NeuSwitch
              value={isNewDevice}
              onValueChange={handleToggleNewDevice}
            />
          </NeuView>

          {/* Device Type */}
          <NeuInput
            label="نوع الجهاز"
            value={deviceType}
            onChangeText={setDeviceType}
            placeholder="نوع وموديل الجهاز"
          />

          {/* Battery */}
          <NeuInput
            label="نسبة البطارية"
            value={batteryPct}
            onChangeText={(txt) => setBatteryPct(convertArabicIndicDigits(txt))}
            keyboardType="number-pad"
            placeholder="100"
            editable={!isNewDevice}
          />

          {/* Storage */}
          <NeuInput
            label="مساحة التخزين (جيجا)"
            value={storageGb}
            onChangeText={(txt) => setStorageGb(convertArabicIndicDigits(txt))}
            keyboardType="number-pad"
            placeholder="256"
          />

          {/* Device Number */}
          <NeuInput
            label="رقم الجهاز"
            value={deviceNumber}
            onChangeText={(txt) => setDeviceNumber(convertArabicIndicDigits(txt))}
            placeholder="IMEI أو الرقم التسلسلي"
            autoCapitalize="characters"
          />

          {/* Condition Notes */}
          <NeuInput
            label="حالة وملاحظات الجهاز (اختياري)"
            value={conditionNotes}
            onChangeText={setConditionNotes}
            placeholder="ملاحظات الفحص"
            editable={!isNewDevice}
          />

          {/* Buyer */}
          <NeuInput
            label="اسم المشتري"
            value={buyerName}
            onChangeText={setBuyerName}
            placeholder="اسم المشتري"
          />

          {/* Seller */}
          <NeuInput
            label="اسم البائع"
            value={sellerName}
            onChangeText={setSellerName}
            placeholder="اسم البائع"
          />

          {/* Phone */}
          <NeuInput
            label={isSale ? 'رقم تليفون المشتري (اختياري)' : 'رقم تليفون البائع (اختياري)'}
            value={partyPhone}
            onChangeText={(txt) => setPartyPhone(convertArabicIndicDigits(txt))}
            keyboardType="phone-pad"
            placeholder="01xxxxxxxxx"
          />

          {/* Tax Period */}
          <NeuInput
            label="مدة الضريبة"
            value={taxPeriod}
            onChangeText={setTaxPeriod}
            placeholder="كاملة أو سنة"
            editable={!isNewDevice}
          />

          {/* Price */}
          <NeuInput
            label="السعر"
            value={price}
            onChangeText={(txt) => setPrice(convertArabicIndicDigits(txt))}
            keyboardType="decimal-pad"
            placeholder="0"
          />

          {/* If Sale: Warranty & Discount */}
          {isSale && (
            <>
              <NeuInput
                label="كود الخصم (اختياري)"
                value={discountCode}
                onChangeText={setDiscountCode}
                placeholder="كود الخصم"
                autoCapitalize="characters"
              />

              <View style={styles.warrantyRow}>
                <View style={styles.dropdownWrap}>
                  <NeuDropdown
                    label="مدة الضمان"
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
                      label="المدة"
                      value={warrantyValue}
                      onChangeText={(txt) => setWarrantyValue(convertArabicIndicDigits(txt))}
                      keyboardType="number-pad"
                      placeholder="المدة"
                    />
                  </View>
                ) : null}
              </View>
            </>
          )}
            </View>
          </TouchableWithoutFeedback>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Floating Save Button with title «حفظ التعديلات» (§8.2.1 / screen 26) */}
      <AddInvoiceBar
        title="حفظ التعديلات"
        onPress={handleSave}
        disabled={!isFormValid || saving}
        loading={saving}
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
  warrantyRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  dropdownWrap: {
    flex: 1,
  },
  warrantyValueWrap: {
    width: 100,
  },
});
