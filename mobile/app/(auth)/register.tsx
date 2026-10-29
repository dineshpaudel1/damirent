import React, { useState } from 'react';
import {
  Image,
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
import { useAuthStore } from '@/store/auth.store';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';
import {
  emailError,
  passwordError,
  confirmPasswordError,
  fullNameError,
} from '@/utils/validators';
import type { ApiError } from '@/types';
import { AxiosError } from 'axios';

export default function RegisterScreen() {
  const { register } = useAuthStore();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    full_name?: string;
    password?: string;
    confirm_password?: string;
    form?: string;
  }>({});
  const [loading, setLoading] = useState(false);

  function validate(): boolean {
    const e: typeof errors = {};
    const fe = fullNameError(fullName);
    const ee = emailError(email);
    const pe = passwordError(password);
    const ce = confirmPasswordError(password, confirmPassword);
    if (fe) e.full_name = fe;
    if (ee) e.email = ee;
    if (pe) e.password = pe;
    if (ce) e.confirm_password = ce;
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleRegister() {
    if (!validate()) return;
    setLoading(true);
    setErrors({});
    try {
      const result = await register({
        email: email.trim().toLowerCase(),
        full_name: fullName.trim(),
        password,
        confirm_password: confirmPassword,
      });
      router.push({
        pathname: '/(auth)/otp',
        params: { email: email.trim().toLowerCase(), devOtp: result.otp ?? '' },
      });
    } catch (err) {
      const axiosErr = err as AxiosError<ApiError>;
      const fieldErrors = axiosErr.response?.data?.field_errors;
      if (fieldErrors) {
        setErrors({
          email: fieldErrors.email?.[0],
          full_name: fieldErrors.full_name?.[0],
          password: fieldErrors.password?.[0],
          confirm_password: fieldErrors.confirm_password?.[0],
        });
      } else if (!axiosErr.response) {
        setErrors({ form: 'Cannot connect to server. Check your network or API URL.' });
      } else {
        setErrors({ form: axiosErr.response?.data?.error ?? 'Registration failed.' });
      }
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
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing['2xl'] },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ── Brand ─────────────────────────────────────── */}
        <View style={styles.brand}>
          <Image
            source={require('@/assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.tagline}>Join the Kathmandu rental community</Text>
        </View>

        {/* ── Form card ─────────────────────────────────── */}
        <View style={[styles.card, Shadow.md]}>
          <View style={styles.cardHead}>
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>Start renting or earning today</Text>
          </View>

          {/* Error banner */}
          {errors.form && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={16} color={Colors.error} />
              <Text style={styles.errorBannerText}>{errors.form}</Text>
            </View>
          )}

          {/* Fields */}
          <View style={styles.fields}>
            <Input
              label="Full name"
              placeholder="Aarav Sharma"
              value={fullName}
              onChangeText={setFullName}
              error={errors.full_name}
              autoCapitalize="words"
              autoComplete="name"
              returnKeyType="next"
              leftIcon={<Ionicons name="person-outline" size={18} color={Colors.textTertiary} />}
            />
            <Input
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              error={errors.email}
              keyboardType="email-address"
              autoComplete="email"
              autoCapitalize="none"
              returnKeyType="next"
              leftIcon={<Ionicons name="mail-outline" size={18} color={Colors.textTertiary} />}
            />
            <Input
              label="Password"
              placeholder="Minimum 8 characters"
              value={password}
              onChangeText={setPassword}
              error={errors.password}
              secureTextEntry={!showPassword}
              autoComplete="new-password"
              returnKeyType="next"
              leftIcon={<Ionicons name="lock-closed-outline" size={18} color={Colors.textTertiary} />}
              rightIcon={eyeIcon}
              onRightIconPress={() => setShowPassword((v) => !v)}
            />
            <Input
              label="Confirm password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              error={errors.confirm_password}
              secureTextEntry={!showPassword}
              autoComplete="new-password"
              returnKeyType="done"
              onSubmitEditing={handleRegister}
              leftIcon={<Ionicons name="lock-closed-outline" size={18} color={Colors.textTertiary} />}
            />
          </View>

          {/* CTA */}
          <Button
            label="Create account"
            onPress={handleRegister}
            loading={loading}
            size="lg"
          />

          {/* Terms */}
          <Text style={styles.terms}>
            By signing up you agree to our{' '}
            <Text style={styles.termsLink}>Terms of Service</Text>
            {' '}and{' '}
            <Text style={styles.termsLink}>Privacy Policy</Text>.
          </Text>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Switch to login */}
          <View style={styles.switchRow}>
            <Text style={styles.switchText}>Already have an account?</Text>
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Text style={styles.switchLink}>Sign in</Text>
            </Pressable>
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
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.base,
    gap: Spacing.lg,
  },

  // ── Brand ─────────────────────────────────────────────
  brand: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  logo: {
    width: 160,
    height: 60,
  },
  tagline: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // ── Card ──────────────────────────────────────────────
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius['2xl'],
    padding: Spacing.xl,
    gap: Spacing.base,
  },
  cardHead: {
    gap: 4,
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
  },

  // ── Error banner ──────────────────────────────────────
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
  errorBannerText: {
    flex: 1,
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.error,
  },

  // ── Fields ────────────────────────────────────────────
  fields: {
    gap: Spacing.md,
  },

  // ── Terms ─────────────────────────────────────────────
  terms: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: Typography.fontSize.xs * 1.7,
    marginTop: -Spacing.xs,
  },
  termsLink: {
    fontFamily: Typography.fontFamily.medium,
    color: Colors.primary,
  },

  // ── Divider ───────────────────────────────────────────
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
  dividerLabel: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
  },

  // ── Switch row ────────────────────────────────────────
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },
  switchText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.base,
    color: Colors.textSecondary,
  },
  switchLink: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.base,
    color: Colors.primary,
  },
});
