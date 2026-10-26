import React, { useEffect, useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  ViewStyle,
  StyleProp,
  TouchableWithoutFeedback,
  PanResponder,
  Platform,
  Keyboard,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '@/theme/ThemeContext';

export interface NeuSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function NeuSheet({
  visible,
  onClose,
  title,
  children,
  style,
}: NeuSheetProps) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(600);
  const opacity = useSharedValue(0);
  const keyboardShift = useSharedValue(0);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setIsKeyboardOpen(true);
        // Moderate lift (~120px) to keep input clearly visible with ample space
        // without pushing the sheet to the top of the screen
        keyboardShift.value = withTiming(-120, { duration: 250 });
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsKeyboardOpen(false);
        keyboardShift.value = withTiming(0, { duration: 220 });
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardShift]);

  useEffect(() => {
    if (visible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      opacity.value = withTiming(1, { duration: 250 });
      translateY.value = withSpring(0, {
        damping: 28,
        stiffness: 260,
        mass: 1,
      });
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(600, { duration: 250 });
    }
  }, [visible, opacity, translateY]);

  const handleDismiss = useCallback(() => {
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    opacity.value = withTiming(0, { duration: 180 });
    translateY.value = withTiming(600, { duration: 220 }, (finished) => {
      if (finished) {
        runOnJS(onClose)();
      }
    });
  }, [onClose, opacity, translateY]);

  // Pan responder for native iOS drag-to-dismiss gesture
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return Math.abs(gestureState.dy) > 3;
        },
        onPanResponderGrant: () => {
          Keyboard.dismiss();
        },
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            translateY.value = gestureState.dy;
          } else {
            translateY.value = gestureState.dy * 0.2;
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 65 || gestureState.vy > 0.4) {
            handleDismiss();
          } else {
            translateY.value = withSpring(0, {
              damping: 24,
              stiffness: 280,
            });
          }
        },
      }),
    [handleDismiss, translateY]
  );

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value + keyboardShift.value }],
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
        <TouchableWithoutFeedback
          onPress={() => {
            if (isKeyboardOpen) {
              Keyboard.dismiss();
            } else {
              handleDismiss();
            }
          }}
        >
          <Animated.View
            style={[
              styles.backdrop,
              { backgroundColor: 'rgba(0, 0, 0, 0.45)' },
              backdropStyle,
            ]}
          />
        </TouchableWithoutFeedback>

        <Animated.View style={[styles.sheetWrapper, sheetStyle]}>
          <View
            style={[
              styles.sheetContent,
              {
                paddingBottom: Math.max(insets.bottom + 12, 28),
                backgroundColor: colors.surface,
                boxShadow: [
                  {
                    offsetX: 0,
                    offsetY: -6,
                    blurRadius: 20,
                    color: isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.12)',
                  },
                ],
              },
              style,
            ]}
          >
            {/* Grabber Handle & Draggable Header Area */}
            <View {...panResponder.panHandlers} style={styles.headerArea}>
              <View style={styles.grabberRow}>
                <View
                  style={[
                    styles.grabber,
                    { backgroundColor: isDark ? '#4A4F58' : '#BEC2C9' },
                  ]}
                />
              </View>

              {/* Title */}
              {title ? (
                <View style={styles.titleRow}>
                  <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
                </View>
              ) : null}
            </View>

            {/* Content wrapped with tap-to-dismiss keyboard */}
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
              <View style={styles.bodyContent}>
                {children}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheetWrapper: {
    width: '100%',
  },
  sheetContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  headerArea: {
    width: '100%',
    paddingBottom: 4,
  },
  bodyContent: {
    width: '100%',
  },
  grabberRow: {
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 10,
  },
  grabber: {
    width: 44,
    height: 5,
    borderRadius: 3,
  },
  titleRow: {
    alignItems: 'center',
    marginVertical: 10,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Tajawal-Bold',
    lineHeight: 26,
    paddingTop: 2,
  },
});
