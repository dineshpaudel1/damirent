import type { BookingStatus } from '@/types';

/**
 * Format an integer NPR amount as "NPR X,XXX"
 */
export function formatPrice(amount: number): string {
  return `NPR ${amount.toLocaleString('en-IN')}`;
}

/**
 * Format a per-day price as "NPR X,XXX / day"
 */
export function formatPricePerDay(amount: number): string {
  return `${formatPrice(amount)} / day`;
}

/**
 * Format ISO date string as "Nov 15, 2024"
 */
export function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format date range as "Nov 15 – Nov 18, 2024"
 */
export function formatDateRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endStr = end.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${startStr} – ${endStr}`;
}

/**
 * Return relative time string like "2h ago", "3 days ago"
 */
export function formatRelativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffSeconds = Math.floor((now - then) / 1000);

  if (diffSeconds < 60) return 'just now';
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}d ago`;
  return formatDate(isoDate);
}

/**
 * Human-readable booking status label
 */
const STATUS_LABELS: Record<BookingStatus, string> = {
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  payment_pending: 'Payment Pending',
  confirmed: 'Confirmed',
  active: 'Active',
  completed: 'Completed',
  cancelled_by_renter: 'Cancelled',
  cancelled_by_owner: 'Cancelled by Owner',
  expired: 'Expired',
  disputed: 'Disputed',
};

export function formatBookingStatus(status: BookingStatus): string {
  return STATUS_LABELS[status] ?? status;
}

/**
 * Format a star rating — e.g. "4.8" → "4.8 ★"
 */
export function formatRating(rating: string | number): string {
  const num = typeof rating === 'string' ? parseFloat(rating) : rating;
  if (isNaN(num) || num === 0) return 'No reviews';
  return `${num.toFixed(1)} ★`;
}
