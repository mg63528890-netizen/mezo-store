import React from 'react';
import { View, StyleSheet, StyleProp } from 'react-native';
import { Image, ImageStyle } from 'expo-image';

interface StoreLogoProps {
  size?: number;
  color?: string;
  useImage?: boolean;
  style?: StyleProp<ImageStyle>;
}

const LOGO_SM = require('@/../assets/branding/logo-sm.png');
const LOGO_LG = require('@/../assets/branding/logo.png');

export function StoreLogo({ size = 44, style }: StoreLogoProps) {
  // For small sizes (top bars, tab items, cards), use the optimized 128px asset
  const source = size <= 64 ? LOGO_SM : LOGO_LG;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Image
        source={source}
        style={[{ width: size, height: size }, style]}
        contentFit="contain"
        priority="high"
        cachePolicy="memory-disk"
        transition={0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
