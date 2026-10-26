import React, { useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '@/theme/ThemeContext';
import { NeuButton } from './NeuButton';

export interface NeuDialogProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  confirmLabel?: string;
  confirmText?: string;
  cancelLabel?: string;
  cancelText?: string;
  onConfirm: () => void;
  isDanger?: boolean;
  variant?: 'gold' | 'danger' | 'secondary';
  loading?: boolean;
}

export function NeuDialog({
  visible,
  onClose,
  title,
  message,
  confirmLabel,
  confirmText,
  cancelLabel,
  cancelText,
  onConfirm,
  isDanger = false,
  variant,
  loading = false,
}: NeuDialogProps) {
  const { colors, isDark } = useAppTheme();
  const effectiveIsDanger = isDanger || variant === 'danger';
  const effectiveConfirmText = confirmText || confirmLabel || 'موافق';
  const effectiveCancelText = cancelText || cancelLabel || 'إلغاء';
  const scale = useSharedValue(0.92);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      Haptics.notificationAsync(
        isDanger
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Success
      ).catch(() => {});
      opacity.value = withTiming(1, { duration: 180 });
      scale.value = withSpring(1, { damping: 20, stiffness: 300 });
    } else {
      opacity.value = withTiming(0, { duration: 150 });
      scale.value = withTiming(0.92, { duration: 150 });
    }
  }, [visible, isDanger, opacity, scale]);

  const handleDismiss = () => {
    opacity.value = withTiming(0, { duration: 120 });
    scale.value = withTiming(0.92, { duration: 120 }, (finished) => {
      if (finished) {
        runOnJS(onClose)();
      }
    });
  };

  const handleConfirm = () => {
    handleDismiss();
    onConfirm();
  };

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const dialogStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleDismiss}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={handleDismiss}>
          <Animated.View
            style={[
              styles.backdrop,
              { backgroundColor: 'rgba(0, 0, 0, 0.5)' },
              backdropStyle,
            ]}
          />
        </TouchableWithoutFeedback>

        <Animated.View style={[styles.dialogWrapper, dialogStyle]}>
          <View
            style={[
              styles.dialogCard,
              {
                backgroundColor: colors.surface,
                boxShadow: [
                  {
                    offsetX: 0,
                    offsetY: 8,
                    blurRadius: 28,
                    color: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.16)',
                  },
                  {
                    offsetX: 0,
                    offsetY: 2,
                    blurRadius: 8,
                    color: isDark ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.06)',
                  },
                ],
              },
            ]}
          >
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            {message ? (
              <Text style={[styles.message, { color: colors.textMuted }]}>
                {message}
              </Text>
            ) : null}

            <View style={styles.buttonRow}>
              <NeuButton
                title={effectiveConfirmText}
                variant={effectiveIsDanger ? 'danger' : 'gold'}
                onPress={handleConfirm}
                loading={loading}
                style={styles.actionButton}
              />
              <NeuButton
                title={effectiveCancelText}
                variant="secondary"
                onPress={handleDismiss}
                disabled={loading}
                style={styles.actionButton}
              />
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  dialogWrapper: {
    width: '100%',
    maxWidth: 340,
    zIndex: 10,
  },
  dialogCard: {
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Tajawal-Bold',
    lineHeight: 26,
    paddingTop: 2,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    fontFamily: 'Tajawal-Regular',
    lineHeight: 22,
    paddingTop: 2,
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonRow: {
    width: '100%',
    gap: 10,
  },
  actionButton: {
    width: '100%',
    marginVertical: 2,
  },
});
