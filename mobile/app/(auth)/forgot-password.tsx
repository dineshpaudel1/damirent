import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '@/services/auth.service';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';
import { emailError, isValidOTP } from '@/utils/validators';
import { AxiosError } from 'axios';
import type { ApiError } from '@/types';

type Step = 'email' | 'reset';

function InfoBanner({
  icon,
  text,
  type,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  type: 'error' | 'success' | 'info';
}) {
  const map = {
    error: { bg: Colors.errorSurface, border: Colors.error + '33', color: Colors.error },
    success: { bg: Colors.successSurface, border: Colors.success + '44', color: Colors.success },
    info: { bg: Colors.primarySurface, border: Colors.primary + '33', color: Colors.primary },
  }[type];
  return (
    <View style={[styles.banner, { backgroundColor: map.bg, borderColor: map.border }]}>
      <Ionicons name={icon} size={15} color={map.color} />
      <Text style={[styles.bannerText, { color: type === 'error' ? map.color : Colors.textSecondary }]}>
        {text}
      </Text>
    </View>
  );
}

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSendOTP() {
    const ee = emailError(email);
    if (ee) { setError(ee); return; }
    setLoading(true);
    setError('');
    try {
      await authService.initiatePasswordReset({ email: email.trim().toLowerCase() });
    } catch {
      // Email enumeration protection — always show success message
    } finally {
      setSuccess('If that email is registered, a reset code has been sent.');
      setStep('reset');
      setLoading(false);
    }
  }

  async function handleReset() {
    if (!isValidOTP(otp)) { setError('Enter the 6-digit code'); return; }
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    setError('');
    try {
      await authService.confirmPasswordReset({
        email: email.trim().toLowerCase(),
        otp,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      router.replace('/(auth)/login');
    } catch (err) {
      const axiosErr = err as AxiosError<ApiError>;
      setError(axiosErr.response?.data?.error ?? 'Reset failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const eyeIcon = (
    <Ionicons
      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
      size={18}
      color={Colors.textTertiary}
    />
  );

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
        <Text style={styles.headerTitle}>Reset password</Text>
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

        {/* ── Step 1: Email ─────────────────────────────── */}
        {step === 'email' && (
          <>
            {/* Icon */}
            <View style={styles.iconWrap}>
              <View style={styles.iconCircle}>
                <Ionicons name="lock-open-outline" size={32} color={Colors.primary} />
              </View>
            </View>

            {/* Card */}
            <View style={[styles.card, Shadow.md]}>
              <View style={styles.cardHead}>
                <Text style={styles.title}>Forgot password?</Text>
                <Text style={styles.subtitle}>
                  Enter your account email and we'll send you a reset code.
                </Text>
              </View>

              {error ? (
                <InfoBanner icon="alert-circle-outline" text={error} type="error" />
              ) : null}

              <Input
                label="Email address"
                placeholder="you@example.com"
                value={email}
                onChangeText={(v) => { setError(''); setEmail(v); }}
                keyboardType="email-address"
                autoComplete="email"
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleSendOTP}
                leftIcon={<Ionicons name="mail-outline" size={18} color={Colors.textTertiary} />}
              />

              <Button
                label="Send reset code"
                onPress={handleSendOTP}
                loading={loading}
                size="lg"
              />

              <Pressable
                style={styles.backToLogin}
                onPress={() => router.back()}
                hitSlop={8}
              >
                <Ionicons name="arrow-back" size={14} color={Colors.primary} />
                <Text style={styles.backToLoginText}>Back to sign in</Text>
              </Pressable>
            </View>
          </>
        )}

        {/* ── Step 2: Reset ─────────────────────────────── */}
        {step === 'reset' && (
          <>
            {/* Icon */}
            <View style={styles.iconWrap}>
              <View style={styles.iconCircle}>
                <Ionicons name="key-outline" size={32} color={Colors.primary} />
              </View>
            </View>

            {/* Card */}
            <View style={[styles.card, Shadow.md]}>
              <View style={styles.cardHead}>
                <Text style={styles.title}>Enter reset code</Text>
                <Text style={styles.subtitle}>
                  Check your inbox at{' '}
                  <Text style={styles.emailHighlight}>{email}</Text>
                  {' '}and enter the code below.
                </Text>
              </View>

              {success ? (
                <InfoBanner icon="checkmark-circle-outline" text={success} type="success" />
              ) : null}

              {error ? (
                <InfoBanner icon="alert-circle-outline" text={error} type="error" />
              ) : null}

              <View style={styles.fields}>
                <Input
                  label="6-digit reset code"
                  placeholder="• • • • • •"
                  value={otp}
                  onChangeText={(v) => { setError(''); setOtp(v.replace(/\D/g, '').slice(0, 6)); }}
                  keyboardType="number-pad"
                  maxLength={6}
                  leftIcon={<Ionicons name="keypad-outline" size={18} color={Colors.textTertiary} />}
                />
                <Input
                  label="New password"
                  placeholder="Minimum 8 characters"
                  value={newPassword}
                  onChangeText={(v) => { setError(''); setNewPassword(v); }}
                  secureTextEntry={!showPassword}
                  returnKeyType="next"
                  leftIcon={<Ionicons name="lock-closed-outline" size={18} color={Colors.textTertiary} />}
                  rightIcon={eyeIcon}
                  onRightIconPress={() => setShowPassword((v) => !v)}
                />
                <Input
                  label="Confirm new password"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChangeText={(v) => { setError(''); setConfirmPassword(v); }}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleReset}
                  leftIcon={<Ionicons name="lock-closed-outline" size={18} color={Colors.textTertiary} />}
                />
              </View>

              <Button
                label="Reset password"
                onPress={handleReset}
                loading={loading}
                size="lg"
              />

              <Pressable
                style={styles.backToLogin}
                onPress={() => { setStep('email'); setError(''); setSuccess(''); }}
                hitSlop={8}
              >
                <Ionicons name="arrow-back" size={14} color={Colors.primary} />
                <Text style={styles.backToLoginText}>Try a different email</Text>
              </Pressable>
            </View>
          </>
        )}

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
    gap: Spacing.base,
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

  // ── Fields ──────────────────────────────────────────────
  fields: {
    gap: Spacing.md,
  },

  // ── Banner ──────────────────────────────────────────────
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  bannerText: {
    flex: 1,
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    lineHeight: Typography.fontSize.sm * 1.6,
  },

  // ── Back link ───────────────────────────────────────────
  backToLogin: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: Spacing.xs,
  },
  backToLoginText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
  },
});
