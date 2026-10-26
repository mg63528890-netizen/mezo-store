import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://mslzklitxmrukmsoavbf.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const DEVICE_TOKEN_KEY = 'mezo_device_token';
export const SESSION_TOKEN_KEY = 'mezo_supabase_session';
export const BIOMETRIC_ENABLED_KEY = 'mezo_biometric_lock_enabled';
export const NAV_STATE_KEY = 'mezo_restored_nav_state';

// SecureStore custom adapter for Supabase auth
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

let activeDeviceToken: string | null = null;

// Eagerly load stored token in memory as early as possible
SecureStore.getItemAsync(DEVICE_TOKEN_KEY).then((token) => {
  if (token && !activeDeviceToken) {
    setClientDeviceToken(token);
  }
}).catch(() => {});

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: (url, options: any = {}) => {
      const rawHeaders = options?.headers;
      const headers: Record<string, string> = {};

      if (rawHeaders) {
        if (typeof rawHeaders.forEach === 'function') {
          rawHeaders.forEach((val: string, key: string) => {
            headers[key] = val;
          });
        } else if (typeof rawHeaders === 'object') {
          Object.assign(headers, rawHeaders);
        }
      }

      if (activeDeviceToken) {
        headers['x-device-token'] = activeDeviceToken;
      }

      return fetch(url, { ...options, headers });
    },
  },
});

/**
 * Updates the global headers so that every RPC and Supabase request
 * includes the x-device-token required by get_verified_device_id()
 */
export function setClientDeviceToken(token: string | null) {
  activeDeviceToken = token;
  if ((supabase as any)?.rest?.headers) {
    if (typeof (supabase as any).rest.headers.set === 'function') {
      if (token) {
        (supabase as any).rest.headers.set('x-device-token', token);
      } else {
        (supabase as any).rest.headers.delete('x-device-token');
      }
    }
    (supabase as any).rest.headers['x-device-token'] = token;
  }
}

/**
 * Loads stored device token from SecureStore and configures client headers
 */
export async function initializeDeviceToken(): Promise<string | null> {
  try {
    const token = await SecureStore.getItemAsync(DEVICE_TOKEN_KEY);
    if (token) {
      setClientDeviceToken(token);
    }
    return token;
  } catch {
    return null;
  }
}

export async function storeDeviceToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(DEVICE_TOKEN_KEY, token, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  setClientDeviceToken(token);
}

export async function clearStoredDeviceToken(): Promise<void> {
  await SecureStore.deleteItemAsync(DEVICE_TOKEN_KEY);
  setClientDeviceToken(null);
}

export interface VerifyAccessParams {
  code: string;
  deviceName?: string;
  model?: string;
  osVersion?: string;
}

export async function verifyAccessAndLogin(params: VerifyAccessParams) {
  const existingToken = await SecureStore.getItemAsync(DEVICE_TOKEN_KEY);

  const { data, error } = await supabase.rpc('verify_access', {
    p_code: params.code.trim(),
    p_device_token: existingToken || null,
    p_device_name: params.deviceName || (Platform.OS === 'ios' ? 'iPhone' : 'Android'),
    p_model: params.model || Platform.OS,
    p_os_version: params.osVersion || String(Platform.Version),
  });

  if (error) {
    throw error;
  }

  const { device_token, email, password } = data;

  if (device_token) {
    await storeDeviceToken(device_token);
  }

  // Sign in to Supabase Auth to obtain valid JWT session
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    throw authError;
  }

  return {
    session: authData.session,
    deviceToken: device_token,
  };
}

export async function logoutDevice() {
  try {
    // 1. Call server logout_device RPC to set is_logged_in=false
    await supabase.rpc('logout_device');
  } catch {
    // Ignore network error on logout
  }

  // 2. Clear Supabase local session (local scope only to not affect other devices)
  await supabase.auth.signOut({ scope: 'local' });

  // 3. Clear draft and page restoration state
  await SecureStore.deleteItemAsync(NAV_STATE_KEY).catch(() => {});

  // Note: Per §5.4, we KEEP the stored device_token so the next login reuses the same device record!
}
