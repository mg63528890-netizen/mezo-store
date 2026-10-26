import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  StyleSheet,
  ViewStyle,
  StyleProp,
  I18nManager,
} from 'react-native';
import { useAppTheme } from '@/theme/ThemeContext';
import { convertArabicIndicDigits } from '@/utils/format';
import { NeuView } from './NeuView';

export interface NeuInputProps extends Omit<TextInputProps, 'onChangeText'> {
  label?: string;
  optional?: boolean;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
  onChangeText?: (text: string) => void;
  autoConvertDigits?: boolean;
}

export function NeuInput({
  label,
  optional = false,
  error,
  value,
  placeholder,
  onChangeText,
  containerStyle,
  keyboardType,
  autoConvertDigits = true,
  style,
  ...rest
}: NeuInputProps) {
  const { colors, isDark } = useAppTheme();
  const [isFocused, setIsFocused] = useState(false);

  const handleChangeText = (text: string) => {
    const formatted = autoConvertDigits ? convertArabicIndicDigits(text) : text;
    onChangeText?.(formatted);
  };

  const isRTL = I18nManager.isRTL;

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: colors.textMuted }]}>
            {label}
            {optional ? (
              <Text style={styles.optionalText}> (اختياري)</Text>
            ) : null}
          </Text>
        </View>
      ) : null}

      <NeuView
        variant="pressed"
        radius={16}
        style={[
          styles.inputContainer,
          isFocused && { borderColor: colors.accent, borderWidth: 1 },
          error ? { borderColor: colors.danger, borderWidth: 1 } : null,
        ]}
      >
        <TextInput
          value={value}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
          keyboardType={keyboardType}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          textAlign={isRTL ? 'right' : 'left'}
          style={[
            styles.input,
            {
              color: colors.text,
              textAlign: isRTL ? 'right' : 'left',
            },
            style,
          ]}
          {...rest}
        />
      </NeuView>

      {error ? (
        <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
    alignSelf: 'stretch',
  },
  labelRow: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  label: {
    fontSize: 13,
    fontFamily: 'Tajawal-Medium',
  },
  optionalText: {
    fontSize: 12,
    fontFamily: 'Tajawal-Regular',
  },
  inputContainer: {
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  input: {
    fontSize: 15,
    fontFamily: 'Tajawal-Regular',
    padding: 0,
    margin: 0,
    width: '100%',
  },
  errorText: {
    fontSize: 11,
    fontFamily: 'Tajawal-Regular',
    marginTop: 4,
    paddingHorizontal: 4,
  },
});
