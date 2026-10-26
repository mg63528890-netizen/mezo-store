import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useAppTheme } from '@/theme/ThemeContext';
import { StoreLogo } from '@/components/neu/StoreLogo';
import { NeuButton } from '@/components/neu/NeuButton';
import { useAuth } from '@/auth/AuthContext';

export function SplashScreenView() {
  const { colors } = useAppTheme();
  const { biometricFailed, retryBiometrics } = useAuth();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <StoreLogo size={120} />

      {biometricFailed ? (
        <View style={styles.retryContainer}>
          <Text style={[styles.retryText, { color: colors.textMuted }]}>
            يرجى تأكيد الهوية للمتابعة
          </Text>
          <NeuButton
            title="إعادة محاولة البصمة"
            variant="gold"
            onPress={retryBiometrics}
            style={styles.retryButton}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  retryContainer: {
    position: 'absolute',
    bottom: 80,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  retryText: {
    fontFamily: 'Tajawal-Medium',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    width: '100%',
  },
});
