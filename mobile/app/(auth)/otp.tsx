import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '@/services/auth.service';
import Button from '@/components/ui/Button';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';
import { isValidOTP } from '@/utils/validators';
import type { ApiError } from '@/types';
import { AxiosError } from 'axios';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;

export default function OTPScreen() {
  const { email, devOtp } = useLocalSearchParams<{ email: string; devOtp?: string }>();
  const insets = useSafeAreaInsets();

  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inputRef = useRef<any>(null);

  useEffect(() => {
    if (!email) router.replace('/(auth)/login');
  }, [email]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  useEffect(() => {
    if (devOtp && devOtp.length === OTP_LENGTH) setOtp(devOtp);
  }, [devOtp]);

  async function handleVerify() {
    if (!isValidOTP(otp)) { setError('Enter the 6-digit code'); return; }
    setLoading(true);
    setError('');
    try {
      await authService.verifyOTP({ email, otp });
      router.replace('/(auth)/login');
    } catch (err) {
      const axiosErr = err as AxiosError<ApiError>;
      setError(axiosErr.response?.data?.error ?? 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setError('');
    try {
      await authService.sendOTP({ email });
      setCountdown(RESEND_COOLDOWN);
      setOtp('');
    } catch {
      setError('Failed to resend code. Try again.');
    } finally {
      setResending(false);
    }
  }

  const digits = otp.split('').concat(Array(OTP_LENGTH - otp.length).fill(''));

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Header ──────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Verify email</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + Spacing['2xl'] },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Icon ────────────────────────────────────────── */}
        <View style={styles.iconWrap}>
          <View style={styles.iconCircle}>
            <Ionicons name="mail-outline" size={32} color={Colors.primary} />
          </View>
        </View>

        {/* ── Card ────────────────────────────────────────── */}
        <View style={[styles.card, Shadow.md]}>
          <View style={styles.cardHead}>
            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.subtitle}>
              We sent a 6-digit code to{'\n'}
              <Text style={styles.emailHighlight}>{email}</Text>
            </Text>
          </View>

          {/* Dev mode banner */}
          {devOtp ? (
            <View style={styles.devBanner}>
              <Ionicons name="code-slash-outline" size={14} color={Colors.secondary} />
              <Text style={styles.devText}>Dev mode · OTP: {devOtp}</Text>
            </View>
          ) : null}

          {/* OTP boxes */}
          <Pressable style={styles.otpRow} onPress={() => inputRef.current?.focus()}>
            {digits.map((d, i) => (
              <View
                key={i}
                style={[
                  styles.otpBox,
                  d !== '' && styles.otpBoxFilled,
                  i === otp.length && styles.otpBoxActive,
                ]}
              >
                <Text style={styles.otpDigit}>{d}</Text>
              </View>
            ))}
          </Pressable>

          {/* Hidden real input */}
          <TextInput
            ref={inputRef}
            value={otp}
            onChangeText={(v) => {
              setError('');
              setOtp(v.replace(/\D/g, '').slice(0, OTP_LENGTH));
            }}
            keyboardType="number-pad"
            maxLength={OTP_LENGTH}
            style={styles.hiddenInput}
            autoFocus
          />

          {/* Error */}
          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={15} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Verify button */}
          <Button
            label="Verify code"
            onPress={handleVerify}
            loading={loading}
            disabled={otp.length < OTP_LENGTH}
            size="lg"
          />

          {/* Resend */}
          <View style={styles.resendRow}>
            <Text style={styles.resendHint}>Didn't receive a code?</Text>
            {countdown > 0 ? (
              <View style={styles.countdownChip}>
                <Ionicons name="time-outline" size={12} color={Colors.textTertiary} />
                <Text style={styles.countdownText}>Resend in {countdown}s</Text>
              </View>
            ) : (
              <Pressable onPress={handleResend} disabled={resending} hitSlop={8}>
                <Text style={styles.resendLink}>
                  {resending ? 'Sending…' : 'Resend code'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // ── Header ──────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.background,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
  },
  headerRight: { width: 36 },

  // ── Scroll ──────────────────────────────────────────────
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
    gap: Spacing.lg,
    justifyContent: 'center',
  },

  // ── Icon ────────────────────────────────────────────────
  iconWrap: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary + '33',
  },

  // ── Card ────────────────────────────────────────────────
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius['2xl'],
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  cardHead: {
    gap: Spacing.sm,
  },
  title: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize['2xl'],
    color: Colors.textPrimary,
  },
  subtitle: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.base,
    color: Colors.textSecondary,
    lineHeight: Typography.fontSize.base * 1.6,
  },
  emailHighlight: {
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.textPrimary,
  },

  // ── Dev banner ──────────────────────────────────────────
  devBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.secondarySurface,
    borderWidth: 1,
    borderColor: Colors.secondary + '33',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  devText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.secondary,
  },

  // ── OTP boxes ───────────────────────────────────────────
  otpRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'center',
  },
  otpBox: {
    width: 48,
    height: 58,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxFilled: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySurface,
  },
  otpBoxActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  otpDigit: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize['2xl'],
    color: Colors.textPrimary,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 0,
    width: 0,
  },

  // ── Error ───────────────────────────────────────────────
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.errorSurface,
    borderWidth: 1,
    borderColor: Colors.error + '33',
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  errorText: {
    flex: 1,
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.error,
  },

  // ── Resend ──────────────────────────────────────────────
  resendRow: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  resendHint: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  countdownChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  countdownText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
  },
  resendLink: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.base,
    color: Colors.primary,
  },
});
