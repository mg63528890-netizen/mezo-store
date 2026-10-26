import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  I18nManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sun, Moon, ArrowRight, ArrowLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useAppTheme } from '@/theme/ThemeContext';
import { STORE_NAME } from '@/constants/theme';
import { StoreLogo } from '@/components/neu/StoreLogo';
import { NeuView } from '@/components/neu/NeuView';

export interface TopBarProps {
  title?: string;
  isRoot?: boolean;
  onBackPress?: () => void;
}

export function TopBar({ title, isRoot = true, onBackPress }: TopBarProps) {
  const { colors, isDark, toggleTheme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const isRTL = I18nManager.isRTL;

  const handleToggleTheme = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    toggleTheme();
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  };

  if (!isRoot) {
    return (
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top + 8,
            backgroundColor: colors.bg,
          },
        ]}
      >
        <View style={styles.pushedRow}>
          {/* Back button on the leading side */}
          <Pressable onPress={handleBack} style={styles.iconButtonWrapper}>
            <NeuView variant="raised" radius={21} style={styles.iconButton}>
              {isRTL ? (
                <ArrowRight size={20} color={colors.text} />
              ) : (
                <ArrowLeft size={20} color={colors.text} />
              )}
            </NeuView>
          </Pressable>

          {/* Centered screen title */}
          <View style={styles.titleWrapper}>
            <Text
              numberOfLines={1}
              style={[styles.screenTitle, { color: colors.text }]}
            >
              {title}
            </Text>
          </View>

          {/* Empty spacer for balance */}
          <View style={styles.iconButtonWrapper} />
        </View>
      </View>
    );
  }

  // Root screen TopBar: Logo + Store Name on leading side, Theme Toggle on trailing side
  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + 10,
          backgroundColor: colors.bg,
        },
      ]}
    >
      <View style={styles.rootRow}>
        {/* Leading Side: Logo mark + Store name */}
        <View style={styles.brandRow}>
          <StoreLogo size={36} />
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[styles.storeNameText, { color: colors.text }]}
          >
            {STORE_NAME}
          </Text>
        </View>

        {/* Trailing Side: Theme toggle */}
        <Pressable onPress={handleToggleTheme} style={styles.iconButtonWrapper}>
          <NeuView variant="raised" radius={21} style={styles.iconButton}>
            {isDark ? (
              <Sun size={18} color={colors.accent} />
            ) : (
              <Moon size={18} color={colors.text} />
            )}
          </NeuView>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    width: '100%',
    zIndex: 10,
  },
  rootRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
  },
  pushedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  storeNameText: {
    fontFamily: 'Tajawal-Bold',
    fontSize: 18,
    lineHeight: 26,
    paddingTop: 2,
  },
  titleWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenTitle: {
    fontFamily: 'Tajawal-Bold',
    fontSize: 18,
    lineHeight: 26,
    paddingTop: 2,
    textAlign: 'center',
  },
  iconButtonWrapper: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
