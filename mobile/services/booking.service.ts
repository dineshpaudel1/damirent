import api from './api';
import type {
  Booking,
  CancellationPenalty,
  CreateBookingRequest,
  BookingStatusHistory,
  Payment,
  PaymentInitiateRequest,
  PaymentInitiateResponse,
  Review,
  CreateReviewRequest,
  Notification,
  PaginatedResponse,
} from '@/types';

export const bookingService = {
  // ─── Bookings ────────────────────────────────────────────────────────────

  async createBooking(data: CreateBookingRequest): Promise<Booking> {
    const res = await api.post('/bookings/', data);
    return res.data;
  },

  async getBooking(id: string): Promise<Booking> {
    const res = await api.get(`/bookings/${id}/`);
    return res.data;
  },

  async listMyBookings(role?: 'renter' | 'owner'): Promise<PaginatedResponse<Booking>> {
    const res = await api.get('/bookings/', { params: role ? { role } : undefined });
    return res.data;
  },

  async getBookingHistory(id: string): Promise<BookingStatusHistory[]> {
    const res = await api.get(`/bookings/${id}/history/`);
    return res.data;
  },

  async approveBooking(id: string): Promise<Booking> {
    const res = await api.post(`/bookings/${id}/approve/`);
    return res.data;
  },

  async rejectBooking(id: string, note?: string): Promise<Booking> {
    const res = await api.post(`/bookings/${id}/reject/`, { note });
    return res.data;
  },

  async cancelBooking(id: string, reason?: string): Promise<Booking> {
    const res = await api.post(`/bookings/${id}/cancel/`, { reason });
    return res.data;
  },

  async activateBooking(id: string): Promise<Booking> {
    const res = await api.post(`/bookings/${id}/activate/`);
    return res.data;
  },

  async confirmReturn(id: string): Promise<Booking> {
    const res = await api.post(`/bookings/${id}/confirm-return/`);
    return res.data;
  },

  async openDispute(id: string, reason: string): Promise<Booking> {
    const res = await api.post(`/bookings/${id}/dispute/`, { reason });
    return res.data;
  },

  // ─── Payments ────────────────────────────────────────────────────────────

  async initiatePayment(data: PaymentInitiateRequest): Promise<PaymentInitiateResponse> {
    const res = await api.post('/payments/initiate/', data);
    return res.data;
  },

  async getPaymentStatus(bookingId: string): Promise<Payment> {
    const res = await api.get(`/payments/${bookingId}/`);
    return res.data;
  },

  async listMyPenalties(): Promise<CancellationPenalty[]> {
    const res = await api.get('/bookings/penalties/');
    return res.data;
  },

  async initiatePenaltyPayment(penaltyId: string): Promise<{ payment_url: string; pidx: string }> {
    const res = await api.post(`/payments/penalty/${penaltyId}/initiate/`);
    return res.data;
  },

  // ─── Reviews ─────────────────────────────────────────────────────────────

  async createReview(data: CreateReviewRequest): Promise<Review> {
    const res = await api.post('/reviews/', data);
    return res.data;
  },

  async getReviewsForProduct(productId: string): Promise<Review[]> {
    const res = await api.get('/reviews/', { params: { product: productId } });
    return res.data;
  },

  // ─── Notifications ────────────────────────────────────────────────────────

  async listNotifications(): Promise<PaginatedResponse<Notification>> {
    const res = await api.get('/notifications/');
    return res.data;
  },

  async markNotificationRead(id: string): Promise<void> {
    await api.post(`/notifications/${id}/mark-read/`);
  },

  async markAllNotificationsRead(): Promise<void> {
    await api.post('/notifications/mark-all-read/');
  },
};
