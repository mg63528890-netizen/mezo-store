import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/theme/ThemeContext';
import { STORE_NAME } from '@/constants/theme';
import { TopBar } from '@/components/navigation/TopBar';
import { StoreLogo } from '@/components/neu/StoreLogo';
import { NeuButton } from '@/components/neu/NeuButton';
import { NeuSheet } from '@/components/neu/NeuSheet';

export default function InvoicesTab() {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const [choiceSheetVisible, setChoiceSheetVisible] = useState(false);

  const handleOpenChoice = () => {
    setChoiceSheetVisible(true);
  };

  const handleSelectSale = () => {
    setChoiceSheetVisible(false);
    router.push('/invoice/new-sale' as any);
  };

  const handleSelectPurchase = () => {
    setChoiceSheetVisible(false);
    router.push('/invoice/new-purchase' as any);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <TopBar isRoot />

      <View style={styles.content}>
        {/* Centered Logo */}
        <StoreLogo size={110} />

        {/* Store Name - Single unbroken phrase */}
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[styles.storeName, { color: colors.text }]}
        >
          {STORE_NAME}
        </Text>

        {/* Primary Action Button */}
        <NeuButton
          title={t('invoices.createNewInvoice', 'إنشاء فاتورة جديدة')}
          variant="gold"
          onPress={handleOpenChoice}
          style={styles.createButton}
        />
      </View>

      {/* Choice Bottom Sheet: بيع / شراء */}
      <NeuSheet
        visible={choiceSheetVisible}
        onClose={() => setChoiceSheetVisible(false)}
        title={t('invoices.createNewInvoice', 'إنشاء فاتورة جديدة')}
      >
        <View style={styles.sheetButtons}>
          <NeuButton
            title={t('invoices.sale', 'بيع')}
            variant="gold"
            onPress={handleSelectSale}
            style={styles.sheetButton}
          />
          <NeuButton
            title={t('invoices.purchase', 'شراء')}
            variant="secondary"
            onPress={handleSelectPurchase}
            style={styles.sheetButton}
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
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 90,
  },
  storeName: {
    fontFamily: 'Tajawal-Bold',
    fontSize: 22,
    lineHeight: 30,
    paddingTop: 2,
    marginTop: 20,
    marginBottom: 28,
    textAlign: 'center',
  },
  createButton: {
    width: '100%',
    maxWidth: 260,
  },
  sheetButtons: {
    paddingVertical: 12,
    gap: 12,
  },
  sheetButton: {
    width: '100%',
  },
});
