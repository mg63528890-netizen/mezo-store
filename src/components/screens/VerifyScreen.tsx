import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '@/theme/ThemeContext';
import { STORE_NAME } from '@/constants/theme';
import { StoreLogo } from '@/components/neu/StoreLogo';
import { NeuInput } from '@/components/neu/NeuInput';
import { NeuButton } from '@/components/neu/NeuButton';
import { verifyAccessAndLogin } from '@/data/supabase';
import { useAuth } from '@/auth/AuthContext';

export function VerifyScreen() {
  const { colors } = useAppTheme();
  const { refreshSession } = useAuth();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!code.trim()) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      await verifyAccessAndLogin({ code });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refreshSession();
    } catch (err: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg = err?.message || '';
      if (msg.includes('LOCKED_OUT')) {
        setErrorMsg('تم تعليق المحاولات مؤقتاً، حاول لاحقاً');
      } else if (msg.includes('Network') || msg.includes('fetch') || msg.includes('Failed to fetch')) {
        setErrorMsg('تعذر الاتصال بالخادم، تحقق من الإنترنت');
      } else {
        setErrorMsg('الرمز غير صحيح');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.container, { backgroundColor: colors.bg }]}
      >
        <View style={styles.content}>
          {/* Top Logo */}
          <StoreLogo size={100} />

          {/* Store Name - Single unbroken phrase */}
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[styles.storeName, { color: colors.text }]}
          >
            {STORE_NAME}
          </Text>

          {/* Code Input */}
          <View style={styles.inputWrapper}>
            <NeuInput
              value={code}
              onChangeText={(txt) => {
                setCode(txt);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder="أدخل الرمز"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              style={styles.textInput}
            />

            {errorMsg ? (
              <Text style={[styles.errorText, { color: colors.danger }]}>
                {errorMsg}
              </Text>
            ) : null}
          </View>

          {/* Gold Login Button */}
          <NeuButton
            title="دخول"
            variant="gold"
            onPress={handleLogin}
            loading={loading}
            disabled={!code.trim() || loading}
            style={styles.loginButton}
          />
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  content: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  storeName: {
    fontFamily: 'Tajawal-Bold',
    fontSize: 22,
    marginTop: 22,
    marginBottom: 28,
    textAlign: 'center',
  },
  inputWrapper: {
    width: '100%',
    marginBottom: 20,
  },
  textInput: {
    textAlign: 'center',
    fontSize: 16,
    fontFamily: 'Tajawal-Medium',
  },
  errorText: {
    fontFamily: 'Tajawal-Medium',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
  loginButton: {
    width: '100%',
  },
});
