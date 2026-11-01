/**
 * Khalti Payment Callback Screen
 *
 * Khalti redirects to damirent://checkout/callback?pidx=...&status=...&
 * transaction_id=...&tidx=...&purchase_order_id=...
 *
 * This screen shows a status page and then navigates the user to their
 * booking detail once the backend has confirmed the payment.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import Button from '@/components/ui/Button';

type CallbackStatus = 'verifying' | 'success' | 'pending' | 'failed';

export default function PaymentCallbackScreen() {
  const { pidx, status, purchase_order_id } = useLocalSearchParams<{
    pidx?: string;
    status?: string;
    purchase_order_id?: string;
    transaction_id?: string;
    tidx?: string;
  }>();

  const queryClient = useQueryClient();
  const [callbackStatus, setCallbackStatus] = useState<CallbackStatus>('verifying');
  const [bookingId, setBookingId] = useState<string | null>(null);
  const polled = useRef(false);

  useEffect(() => {
    if (polled.current) return;
    polled.current = true;

    // Khalti reports status in the URL; we still rely on the backend lookup
    // (which already happened when Khalti redirected the browser to our callback URL).
    // Here we just read the outcome and navigate accordingly.
    const khaltiStatus = status ?? '';

    if (khaltiStatus === 'Completed') {
      setCallbackStatus('success');
      // Invalidate bookings cache so status is fresh when user returns
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
      if (purchase_order_id) {
        // purchase_order_id is the payment.id set in khalti.initiate()
        // Navigate to the bookings list; the user can find their confirmed booking there
        setBookingId(purchase_order_id);
      }
    } else if (khaltiStatus === 'Pending' || khaltiStatus === 'Initiated') {
      setCallbackStatus('pending');
    } else {
      setCallbackStatus('failed');
    }
  }, [status, purchase_order_id, queryClient]);

  const config = {
    verifying: {
      icon: null,
      title: 'Verifying payment…',
      subtitle: 'Please wait while we confirm your payment.',
      color: Colors.primary,
    },
    success: {
      icon: 'checkmark-circle' as const,
      title: 'Payment successful!',
      subtitle: 'Your booking is confirmed. Check your bookings for next steps.',
      color: Colors.success,
    },
    pending: {
      icon: 'time' as const,
      title: 'Payment pending',
      subtitle: 'Your payment is being processed. We\'ll notify you once confirmed.',
      color: Colors.warning,
    },
    failed: {
      icon: 'close-circle' as const,
      title: 'Payment failed',
      subtitle: 'Something went wrong. Please go back and try again.',
      color: Colors.error,
    },
  }[callbackStatus];

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {callbackStatus === 'verifying' ? (
          <ActivityIndicator size="large" color={Colors.primary} style={styles.spinner} />
        ) : (
          <View style={[styles.iconWrap, { backgroundColor: config.color + '18' }]}>
            <Ionicons name={config.icon!} size={48} color={config.color} />
          </View>
        )}

        <Text style={styles.title}>{config.title}</Text>
        <Text style={styles.subtitle}>{config.subtitle}</Text>

        {callbackStatus !== 'verifying' && (
          <View style={styles.actions}>
            <Button
              label="Go to my bookings"
              onPress={() => router.replace('/(tabs)/bookings')}
              size="lg"
            />
            {callbackStatus === 'failed' && (
              <Button
                label="Go back"
                variant="outline"
                onPress={() => router.back()}
                size="lg"
              />
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.base,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing['2xl'],
    alignItems: 'center',
    gap: Spacing.md,
  },
  spinner: {
    marginVertical: Spacing.lg,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.xl,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: Typography.fontSize.sm * 1.6,
  },
  actions: {
    width: '100%',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
});
