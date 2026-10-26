import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Home,
  FileText,
  Clock,
  BarChart2,
  Settings,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/theme/ThemeContext';
import { NeuView } from '@/components/neu/NeuView';

export interface FloatingTabBarProps {
  state: {
    index: number;
    routes: { key: string; name: string; params?: any }[];
  };
  descriptors?: any;
  navigation: {
    emit: (event: any) => any;
    navigate: (name: string, params?: any) => void;
  };
}

interface TabItemConfig {
  name: string;
  labelKey: string;
  labelAr: string;
  labelEn: string;
  icon: (color: string) => React.ReactNode;
}

export function FloatingTabBar({ state, navigation }: FloatingTabBarProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const isAr = (i18n.language || 'ar').startsWith('ar');

  // The 5 tabs in logical order
  const tabs: TabItemConfig[] = [
    {
      name: 'index',
      labelKey: 'tabs.home',
      labelAr: 'الرئيسية',
      labelEn: 'Home',
      icon: (color) => <Home size={22} color={color} />,
    },
    {
      name: 'invoices',
      labelKey: 'tabs.invoices',
      labelAr: 'فواتير',
      labelEn: 'Invoices',
      icon: (color) => <FileText size={22} color={color} />,
    },
    {
      name: 'history',
      labelKey: 'tabs.history',
      labelAr: 'السجل',
      labelEn: 'History',
      icon: (color) => <Clock size={22} color={color} />,
    },
    {
      name: 'reports',
      labelKey: 'tabs.reports',
      labelAr: 'التقارير',
      labelEn: 'Reports',
      icon: (color) => <BarChart2 size={22} color={color} />,
    },
    {
      name: 'settings',
      labelKey: 'tabs.settings',
      labelAr: 'الإعدادات',
      labelEn: 'Settings',
      icon: (color) => <Settings size={22} color={color} />,
    },
  ];

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.outerContainer,
        {
          bottom: Math.max(insets.bottom + 8, 14),
        },
      ]}
    >
      <NeuView variant="raised" radius={36} style={styles.tabBarPill}>
        <View style={styles.tabRow}>
          {tabs.map((tab) => {
            // Find route in state
            const routeIndex = state.routes.findIndex((r: any) => r.name === tab.name);
            const isFocused = state.index === routeIndex;

            const label = t(tab.labelKey, isAr ? tab.labelAr : tab.labelEn);

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: state.routes[routeIndex]?.key || tab.name,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                navigation.navigate(tab.name);
              }
            };

            const activeColor = colors.accent;
            const inactiveColor = colors.textMuted;

            return (
              <Pressable
                key={tab.name}
                onPress={onPress}
                style={styles.tabItem}
              >
                {isFocused ? (
                  <NeuView variant="pressed" radius={26} style={styles.activePill}>
                    {tab.icon(activeColor)}
                    <Text
                      numberOfLines={1}
                      style={[styles.tabLabel, { color: activeColor, fontFamily: 'Tajawal-Bold' }]}
                    >
                      {label}
                    </Text>
                  </NeuView>
                ) : (
                  <View style={styles.inactivePill}>
                    {tab.icon(inactiveColor)}
                    <Text
                      numberOfLines={1}
                      style={[styles.tabLabel, { color: inactiveColor, fontFamily: 'Tajawal-Medium' }]}
                    >
                      {label}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </NeuView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 999,
  },
  tabBarPill: {
    height: 72,
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: '100%',
  },
  tabItem: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activePill: {
    width: '94%',
    height: '92%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  inactivePill: {
    width: '94%',
    height: '92%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 12,
    lineHeight: 16,
    paddingTop: 2,
    marginTop: 2,
    textAlign: 'center',
  },
});
