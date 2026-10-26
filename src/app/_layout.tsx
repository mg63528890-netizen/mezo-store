import React, { useEffect, useState } from 'react';
import { View, StyleSheet, AppState, AppStateStatus } from 'react-native';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useAppTheme } from '@/theme/ThemeContext';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { SplashScreenView } from '@/components/screens/SplashScreenView';
import { VerifyScreen } from '@/components/screens/VerifyScreen';
import { StoreLogo } from '@/components/neu/StoreLogo';
import { Image as ExpoImage } from 'expo-image';
import { notificationService } from '@/utils/notifications';
import '@/locales/i18n'; // Initialize i18n

// Pre-warm logo textures in memory for instant 0ms rendering
ExpoImage.prefetch(require('@/../assets/branding/logo-sm.png')).catch(() => {});
ExpoImage.prefetch(require('@/../assets/branding/logo.png')).catch(() => {});

// Keep native splash screen visible while fonts and auth initialize
SplashScreen.preventAutoHideAsync().catch(() => {});

function AppContent() {
  const { colors } = useAppTheme();
  const { session, isLoading, isSplashComplete } = useAuth();
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    // Hide native splash once React mounts so our branded SplashScreenView is visible immediately
    SplashScreen.hideAsync().catch(() => {});

    // Initialize notification channels, request permissions & schedule daily/weekly reports
    notificationService.init().catch(() => {});

    // Listen to notification tap interactions
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response?.notification?.request?.content?.data as Record<string, any> | undefined;
      if (data?.invoiceId) {
        router.push(`/invoice/${data.invoiceId}` as any);
      } else if (data?.screen === 'reports') {
        router.push('/(tabs)/reports' as any);
      }
    });

    return () => {
      responseSub.remove();
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      setAppState(nextAppState);
    });
    return () => {
      subscription.remove();
    };
  }, []);

  // Show branded splash screen with Mezo logo while auth/session initializes
  if (!isSplashComplete || isLoading) {
    return <SplashScreenView />;
  }

  // 2. If unauthenticated, show Verification Screen (§7)
  if (!session) {
    return <VerifyScreen />;
  }

  // 3. Privacy Snapshot Cover (§10): when inactive/backgrounded in app switcher
  const isBackgrounded = appState !== 'active';

  return (
    <View style={[styles.rootContainer, { backgroundColor: colors.bg }]}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="invoice/new-sale" options={{ headerShown: false }} />
        <Stack.Screen name="invoice/new-purchase" options={{ headerShown: false }} />
        <Stack.Screen name="invoice/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="invoice/edit/[id]" options={{ headerShown: false }} />
      </Stack>

      {/* App Switcher Privacy Snapshot Overlay */}
      {isBackgrounded ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.privacyCover,
            { backgroundColor: colors.bg },
          ]}
        >
          <StoreLogo size={100} />
        </View>
      ) : null}
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Tajawal-Regular': require('@/../assets/fonts/Tajawal-Regular.ttf'),
    'Tajawal-Medium': require('@/../assets/fonts/Tajawal-Medium.ttf'),
    'Tajawal-Bold': require('@/../assets/fonts/Tajawal-Bold.ttf'),
    'Inter': require('@/../assets/fonts/Inter.ttf'),
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },
  privacyCover: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
  },
});
