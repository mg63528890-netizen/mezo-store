import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { Session } from '@supabase/supabase-js';
import {
  supabase,
  initializeDeviceToken,
  BIOMETRIC_ENABLED_KEY,
  NAV_STATE_KEY,
  logoutDevice,
} from '@/data/supabase';
import { api } from '@/data/api';

export const RESTORE_TTL_MINUTES = 15;

interface RestoredNavState {
  route: string;
  params?: any;
  timestamp: number;
}

interface AuthContextType {
  session: Session | null;
  isLoading: boolean;
  isSplashComplete: boolean;
  biometricEnabled: boolean;
  biometricFailed: boolean;
  setBiometricEnabled: (enabled: boolean) => Promise<boolean>;
  retryBiometrics: () => Promise<void>;
  logout: () => Promise<void>;
  saveNavState: (route: string, params?: any) => Promise<void>;
  getRestoredRoute: () => Promise<string | null>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  isLoading: true,
  isSplashComplete: false,
  biometricEnabled: false,
  biometricFailed: false,
  setBiometricEnabled: async () => false,
  retryBiometrics: async () => {},
  logout: async () => {},
  saveNavState: async () => {},
  getRestoredRoute: async () => null,
  refreshSession: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSplashComplete, setIsSplashComplete] = useState(false);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [biometricFailed, setBiometricFailed] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      const splashTimer = new Promise((resolve) => setTimeout(resolve, 2000));

      // 1. Initialize device token in headers
      const deviceToken = await initializeDeviceToken();

      // 2. Load stored session
      const { data: { session: initialSession } } = await supabase.auth.getSession();

      // 3. Check biometric preference
      const bioSetting = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
      const isBioEnabled = bioSetting === 'true';
      if (isMounted) {
        setBiometricEnabledState(isBioEnabled);
      }

      // 4. Verify device validity if session exists
      let validSession = initialSession;
      if (initialSession) {
        if (!deviceToken) {
          await supabase.auth.signOut({ scope: 'local' });
          validSession = null;
        } else {
          const isDeviceValid = await api.checkDevice();
          if (!isDeviceValid) {
            // Device row is invalid or logged out -> clear session
            await supabase.auth.signOut({ scope: 'local' });
            validSession = null;
          }
        }
      }

      if (isMounted) {
        setSession(validSession);
      }

      // Wait for 2 seconds splash duration
      await splashTimer;

      if (!isMounted) return;

      // 5. Handle Biometric check if session is valid and lock is enabled
      if (validSession && isBioEnabled) {
        const bioResult = await LocalAuthentication.authenticateAsync({
          promptMessage: 'تأكيد الهوية للدخول إلى ميزو ستور',
          fallbackLabel: 'استخدام رمز الجهاز',
          disableDeviceFallback: false,
        });

        if (!bioResult.success) {
          setBiometricFailed(true);
          setIsLoading(false);
          setIsSplashComplete(true);
          return;
        }
      }

      setIsLoading(false);
      setIsSplashComplete(true);
    }

    initAuth();

    // Listen to Supabase auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        if (isMounted) {
          setSession(currentSession);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const retryBiometrics = async () => {
    setBiometricFailed(false);
    const bioResult = await LocalAuthentication.authenticateAsync({
      promptMessage: 'تأكيد الهوية للدخول إلى ميزو ستور',
      fallbackLabel: 'استخدام رمز الجهاز',
      disableDeviceFallback: false,
    });

    if (bioResult.success) {
      setBiometricFailed(false);
    } else {
      setBiometricFailed(true);
    }
  };

  const setBiometricEnabled = async (enabled: boolean): Promise<boolean> => {
    if (enabled) {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        return false;
      }

      // Must authenticate successfully before saving
      const testAuth = await LocalAuthentication.authenticateAsync({
        promptMessage: 'تأكيد الهوية لتفعيل قفل التطبيق',
      });

      if (!testAuth.success) {
        return false;
      }
    }

    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false');
    setBiometricEnabledState(enabled);
    return true;
  };

  const logout = async () => {
    await logoutDevice();
    setSession(null);
  };

  const saveNavState = async (route: string, params?: any) => {
    try {
      const state: RestoredNavState = {
        route,
        params,
        timestamp: Date.now(),
      };
      await SecureStore.setItemAsync(NAV_STATE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage errors
    }
  };

  const getRestoredRoute = async (): Promise<string | null> => {
    try {
      const raw = await SecureStore.getItemAsync(NAV_STATE_KEY);
      if (!raw) return null;
      const parsed: RestoredNavState = JSON.parse(raw);
      const ageMinutes = (Date.now() - parsed.timestamp) / (1000 * 60);
      if (ageMinutes <= RESTORE_TTL_MINUTES) {
        return parsed.route;
      }
    } catch {
      // Ignore parse errors
    }
    return null;
  };

  const refreshSession = async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        isLoading,
        isSplashComplete,
        biometricEnabled,
        biometricFailed,
        setBiometricEnabled,
        retryBiometrics,
        logout,
        saveNavState,
        getRestoredRoute,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
