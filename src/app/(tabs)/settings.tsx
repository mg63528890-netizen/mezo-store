import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  I18nManager,
  Pressable,
} from 'react-native';
import * as Updates from 'expo-updates';
import { Printer, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/theme/ThemeContext';
import { useAuth } from '@/auth/AuthContext';
import { STORE_NAME } from '@/constants/theme';
import { TopBar } from '@/components/navigation/TopBar';
import { StoreLogo } from '@/components/neu/StoreLogo';
import { NeuView } from '@/components/neu/NeuView';
import { NeuSwitch } from '@/components/neu/NeuSwitch';
import { NeuSegmented } from '@/components/neu/NeuSegmented';
import { NeuButton } from '@/components/neu/NeuButton';
import { NeuSheet } from '@/components/neu/NeuSheet';
import { NeuDialog } from '@/components/neu/NeuDialog';
import { NeuInput } from '@/components/neu/NeuInput';
import { api } from '@/data/api';
import { supabase } from '@/data/supabase';
import { persistLanguage, SupportedLanguage } from '@/locales/i18n';
import { printerService, PrinterConfig } from '@/utils/printer';

export default function SettingsScreen() {
  const { colors, isDark, toggleTheme } = useAppTheme();
  const { logout, biometricEnabled, setBiometricEnabled } = useAuth();
  const { t, i18n } = useTranslation();

  const isRTL = I18nManager.isRTL;
  const currentLang = (i18n.language as SupportedLanguage) || 'ar';

  const [deviceCount, setDeviceCount] = useState(1);

  // Language confirm dialog
  const [langConfirmVisible, setLangConfirmVisible] = useState(false);
  const [targetLang, setTargetLang] = useState<SupportedLanguage>('ar');

  // Logout confirm dialog
  const [logoutDialogVisible, setLogoutDialogVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Printer sheet state
  const [printerSheetVisible, setPrinterSheetVisible] = useState(false);
  const [printerConfig, setPrinterConfig] = useState<PrinterConfig>({
    ip: '192.168.1.100',
    port: 9100,
    paperWidth: 80,
  });
  const [testPrintLoading, setTestPrintLoading] = useState(false);
  const [testPrintStatus, setTestPrintStatus] = useState<string | null>(null);

  useEffect(() => {
    // 1. Load initial device count
    api.getLoggedInDevicesCount().then(setDeviceCount).catch(() => {});

    // 2. Realtime listener to device_stats
    const channel = supabase
      .channel('settings_device_stats')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'device_stats' },
        (payload) => {
          if (payload.new && (payload.new as any).logged_in_count) {
            setDeviceCount((payload.new as any).logged_in_count);
          }
        }
      )
      .subscribe();

    // 3. Load printer config
    printerService.getConfig().then(setPrinterConfig).catch(() => {});

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleLanguageChange = (val: string) => {
    const lang = val as SupportedLanguage;
    if (lang === currentLang) return;
    setTargetLang(lang);
    setLangConfirmVisible(true);
  };

  const handleConfirmLanguage = async () => {
    setLangConfirmVisible(false);
    await persistLanguage(targetLang);
    // Switch language immediately in memory so UI reacts instantly
    await i18n.changeLanguage(targetLang);
    const shouldBeRTL = targetLang === 'ar';
    if (I18nManager.isRTL !== shouldBeRTL) {
      I18nManager.allowRTL(shouldBeRTL);
      I18nManager.forceRTL(shouldBeRTL);
    }
    try {
      if (Updates.isEnabled) {
        await Updates.reloadAsync();
      }
    } catch {
      // In dev environment, changeLanguage already updated all reactive screens
    }
  };

  const handleBiometricToggle = async (val: boolean) => {
    await setBiometricEnabled(val);
  };

  const handleSavePrinter = async () => {
    await printerService.saveConfig(printerConfig);
    setPrinterSheetVisible(false);
  };

  const handleTestPrint = async () => {
    setTestPrintLoading(true);
    setTestPrintStatus(null);
    const res = await printerService.testPrint(printerConfig);
    setTestPrintLoading(false);
    if (res.success) {
      setTestPrintStatus(isRTL ? 'تم إرسال أمر الطباعة بنجاح' : 'Test print sent successfully');
    } else {
      setTestPrintStatus(res.message || (isRTL ? 'فشلت الطباعة التجريبية' : 'Test print failed'));
    }
  };

  const handleConfirmLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
      setLogoutDialogVisible(false);
    }
  };

  const biometricLabel =
    Platform.OS === 'ios'
      ? t('settings.faceIdLockIos', 'قفل التطبيق بـ Face ID')
      : t('settings.faceIdLockAndroid', 'قفل التطبيق بالبصمة');

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <TopBar isRoot />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 1. Account Card (§8.5) */}
        <NeuView variant="raised" radius={22} style={styles.accountCard}>
          <Text style={[styles.accountLabel, { color: colors.textMuted }]}>
            {t('settings.account', 'الحساب')}
          </Text>

          <View style={styles.brandRow}>
            <StoreLogo size={48} />
            <View style={styles.brandTextSide}>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[styles.accountStoreName, { color: colors.text }]}
              >
                {STORE_NAME}
              </Text>
              <Text style={[styles.accountRole, { color: colors.textMuted }]}>
                {t('settings.managementAccount', 'حساب الإدارة')}
              </Text>
            </View>
          </View>

          {/* Live logged-in devices badge */}
          <View style={styles.badgeRow}>
            <NeuView variant="pressed" radius={12} style={styles.deviceBadge}>
              <Text style={[styles.deviceBadgeText, { color: colors.accent }]}>
                {t('settings.registeredDevices', {
                  count: deviceCount,
                  defaultValue: `الأجهزة المسجلة: ${deviceCount}`,
                })}
              </Text>
            </NeuView>
          </View>
        </NeuView>

        {/* 2. Language Row */}
        <NeuView variant="raised" radius={18} style={styles.settingRow}>
          <Text style={[styles.settingTitle, { color: colors.text }]}>
            {t('settings.language', 'اللغة')}
          </Text>
          <View style={styles.segmentedWrapper}>
            <NeuSegmented
              compact
              options={[
                { value: 'ar', label: 'العربية' },
                { value: 'en', label: 'English' },
              ]}
              value={currentLang}
              onChange={handleLanguageChange}
            />
          </View>
        </NeuView>

        {/* 3. Dark Mode Row */}
        <NeuView variant="raised" radius={18} style={styles.settingRow}>
          <Text style={[styles.settingTitle, { color: colors.text }]}>
            {t('settings.darkMode', 'الوضع الداكن')}
          </Text>
          <NeuSwitch value={isDark} onValueChange={toggleTheme} />
        </NeuView>

        {/* 4. Biometric Lock Row (No sub-caption) */}
        <NeuView variant="raised" radius={18} style={styles.settingRow}>
          <Text style={[styles.settingTitle, { color: colors.text }]}>
            {biometricLabel}
          </Text>
          <NeuSwitch
            value={biometricEnabled}
            onValueChange={handleBiometricToggle}
          />
        </NeuView>

        {/* 5. Printer Setup Row */}
        <Pressable onPress={() => setPrinterSheetVisible(true)}>
          <NeuView variant="raised" radius={18} style={styles.settingRow}>
            <View style={styles.printerTitleRow}>
              <Printer size={18} color={colors.text} />
              <Text style={[styles.settingTitle, { color: colors.text }]}>
                {t('settings.printer', 'الطابعة')}
              </Text>
            </View>
            {isRTL ? (
              <ChevronLeft size={18} color={colors.textMuted} />
            ) : (
              <ChevronRight size={18} color={colors.textMuted} />
            )}
          </NeuView>
        </Pressable>


        {/* 6. Blood-Red Logout Button (§8.5) */}
        <View style={styles.logoutWrapper}>
          <NeuButton
            title={t('settings.logout', 'تسجيل الخروج')}
            variant="danger"
            onPress={() => setLogoutDialogVisible(true)}
            style={styles.logoutButton}
          />
        </View>
      </ScrollView>

      {/* Language Change Confirm Dialog */}
      <NeuDialog
        visible={langConfirmVisible}
        onClose={() => setLangConfirmVisible(false)}
        title={t('settings.language', 'تغيير اللغة')}
        message={t('settings.languageRestartConfirm', 'سيتم تطبيق اللغة في التطبيق')}
        confirmText={t('common.confirm', 'موافق')}
        cancelText={t('common.cancel', 'إلغاء')}
        onConfirm={handleConfirmLanguage}
        variant="gold"
      />

      {/* Logout Confirm Dialog */}
      <NeuDialog
        visible={logoutDialogVisible}
        onClose={() => setLogoutDialogVisible(false)}
        title={t('settings.logoutConfirmTitle', 'تسجيل الخروج')}
        message={t('settings.logoutConfirmMessage', 'هل تريد تسجيل الخروج؟')}
        confirmText={t('settings.logout', 'تسجيل الخروج')}
        cancelText={t('common.cancel', 'إلغاء')}
        onConfirm={handleConfirmLogout}
        variant="danger"
        loading={loggingOut}
      />

      {/* Printer Setup Bottom Sheet (screen 36) */}
      <NeuSheet
        visible={printerSheetVisible}
        onClose={() => setPrinterSheetVisible(false)}
        title={t('settings.printerConfig', 'إعدادات الطابعة')}
      >
        <View style={styles.printerSheetContent}>
          <NeuInput
            label={t('settings.printerIp', 'عنوان IP للطابعة')}
            value={printerConfig.ip}
            onChangeText={(txt) =>
              setPrinterConfig((prev) => ({ ...prev, ip: txt }))
            }
            placeholder="192.168.1.100"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <NeuInput
            label={t('settings.printerPort', 'المنفذ (Port)')}
            value={String(printerConfig.port)}
            onChangeText={(txt) =>
              setPrinterConfig((prev) => ({
                ...prev,
                port: parseInt(txt, 10) || 9100,
              }))
            }
            keyboardType="number-pad"
            placeholder="9100"
          />

          <View style={styles.paperWidthContainer}>
            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
              {t('settings.paperWidth', 'عرض الورق')}
            </Text>
            <NeuSegmented
              options={[
                { value: '58', label: t('settings.paper58', '58 مم') },
                { value: '80', label: t('settings.paper80', '80 مم') },
              ]}
              value={String(printerConfig.paperWidth)}
              onChange={(val) =>
                setPrinterConfig((prev) => ({
                  ...prev,
                  paperWidth: val === '58' ? 58 : 80,
                }))
              }
            />
          </View>

          {testPrintStatus ? (
            <Text
              style={[
                styles.testPrintStatus,
                {
                  color: testPrintStatus.includes('نجاح') || testPrintStatus.includes('success')
                    ? colors.success
                    : colors.danger,
                },
              ]}
            >
              {testPrintStatus}
            </Text>
          ) : null}

          <View style={styles.sheetButtonsRow}>
            <NeuButton
              title={t('settings.testPrint', 'طباعة تجريبية')}
              variant="secondary"
              onPress={handleTestPrint}
              loading={testPrintLoading}
              style={styles.sheetBtnHalf}
            />
            <NeuButton
              title={t('common.save', 'حفظ')}
              variant="gold"
              onPress={handleSavePrinter}
              style={styles.sheetBtnHalf}
            />
          </View>
        </View>
      </NeuSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 125,
    gap: 12,
  },
  accountCard: {
    padding: 20,
    marginBottom: 6,
  },
  accountLabel: {
    fontSize: 12,
    fontFamily: 'Tajawal-Medium',
    lineHeight: 18,
    paddingTop: 1,
    marginBottom: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  brandTextSide: {
    flex: 1,
  },
  accountStoreName: {
    fontSize: 19,
    fontFamily: 'Tajawal-Bold',
    lineHeight: 26,
    paddingTop: 2,
  },
  accountRole: {
    fontSize: 13,
    fontFamily: 'Tajawal-Regular',
    lineHeight: 18,
    paddingTop: 1,
    marginTop: 2,
  },
  badgeRow: {
    marginTop: 14,
    alignItems: 'flex-start',
  },
  deviceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  deviceBadgeText: {
    fontSize: 12,
    fontFamily: 'Tajawal-Bold',
    lineHeight: 18,
    paddingTop: 1,
  },
  settingRow: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 58,
  },
  settingTitle: {
    fontSize: 15,
    fontFamily: 'Tajawal-Medium',
    lineHeight: 22,
    paddingTop: 2,
  },
  segmentedWrapper: {
    width: 150,
  },
  printerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoutWrapper: {
    marginTop: 16,
    width: '100%',
  },
  logoutButton: {
    width: '100%',
  },
  printerSheetContent: {
    paddingVertical: 8,
    gap: 14,
  },
  paperWidthContainer: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: 'Tajawal-Medium',
  },
  testPrintStatus: {
    fontSize: 13,
    fontFamily: 'Tajawal-Medium',
    textAlign: 'center',
    marginTop: 4,
  },
  sheetButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  sheetBtnHalf: {
    flex: 1,
  },
});
