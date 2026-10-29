// ─── User & Auth ─────────────────────────────────────────────────────────────

export type VerificationStatus = 'not_submitted' | 'pending' | 'verified' | 'rejected';

export interface IdentityVerification {
  verification_status: VerificationStatus;
  rejection_reason: string;
  submitted_at: string | null;
  verified_at: string | null;
}

export interface User {
  id: string;
  email: string;
  phone: string | null;
  full_name: string;
  is_verified: boolean;
  date_joined: string;
  profile: UserProfile | null;
  identity_verification: IdentityVerification | null;
}

export interface UserProfile {
  id: string;
  avatar: string | null;
  bio: string | null;
  avg_owner_rating: string;
  avg_renter_rating: string;
  total_listings: number;
  total_rentals: number;
}

// Admin verification dashboard
export interface VerificationRequest {
  id: string;
  user: {
    id: string;
    email: string;
    full_name: string;
    avatar: string | null;
  };
  verification_status: VerificationStatus;
  rejection_reason: string;
  submitted_at: string | null;
  verified_at: string | null;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  full_name: string;
  password: string;
  confirm_password: string;
}

export interface OTPRequest {
  email: string;
}

export interface OTPVerifyRequest {
  email: string;
  otp: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirmRequest {
  email: string;
  otp: string;
  new_password: string;
  confirm_password: string;
}

// ─── Category & Product ──────────────────────────────────────────────────────

export interface Category {
  id: number;
  name: string;
  slug: string;
  parent: number | null;
  children: Category[];
}

export type ProductCondition = 'excellent' | 'good' | 'fair';

export interface Product {
  id: string;
  owner: PublicUser;
  category: Category;
  title: string;
  description: string;
  condition: ProductCondition;
  price_per_day: number;
  security_deposit: number;
  pickup_location: string;
  is_available: boolean;
  is_published: boolean;
  images: ProductImage[];
  avg_rating: string;
  review_count: number;
  created_at: string;
}

export interface ProductImage {
  id: string;
  image: string;
  is_primary: boolean;
  order: number;
}

export interface PublicUser {
  id: string;
  full_name: string;
  is_verified: boolean;
  profile: {
    avatar: string | null;
    avg_owner_rating: string;
    total_listings: number;
  };
}

export interface CreateProductRequest {
  category: number;
  title: string;
  description: string;
  condition: ProductCondition;
  price_per_day: number;
  security_deposit: number;
  pickup_location: string;
}

export interface AvailabilityBlock {
  id: string;
  start_date: string;
  end_date: string;
  block_type: 'owner_blocked' | 'booking_hold';
}

// ─── Booking ─────────────────────────────────────────────────────────────────

export type BookingStatus =
  | 'pending_approval'
  | 'approved'
  | 'payment_pending'
  | 'confirmed'
  | 'active'
  | 'completed'
  | 'cancelled_by_renter'
  | 'cancelled_by_owner'
  | 'expired'
  | 'disputed';

export interface Booking {
  id: string;
  product: Product;
  renter: PublicUser;
  start_date: string;
  end_date: string;
  total_days: number;
  rental_total: number;
  platform_fee: number;
  security_deposit: number;
  total_charged: number;
  status: BookingStatus;
  message: string;
  owner_note: string;
  created_at: string;
  updated_at: string;
}

export interface BookingStatusHistory {
  id: string;
  from_status: BookingStatus | null;
  to_status: BookingStatus;
  changed_by: PublicUser;
  note: string;
  created_at: string;
}

export interface CreateBookingRequest {
  product: string;
  start_date: string;
  end_date: string;
  message?: string;
}

// ─── Payment ─────────────────────────────────────────────────────────────────

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type PaymentGateway = 'khalti';

export interface Payment {
  id: string;
  booking: string;
  amount: number;
  status: PaymentStatus;
  gateway: PaymentGateway;
  gateway_txn_id: string | null;
  created_at: string;
}

export interface PaymentInitiateRequest {
  booking: string;
}

export interface PaymentInitiateResponse {
  payment_url: string;
  pidx: string;
}

// ─── Review ──────────────────────────────────────────────────────────────────

export type ReviewerRole = 'renter' | 'owner';

export interface Review {
  id: string;
  booking: string;
  reviewer: PublicUser;
  reviewer_role: ReviewerRole;
  rating: number;
  comment: string;
  created_at: string;
}

export interface CreateReviewRequest {
  booking: string;
  rating: number;
  comment: string;
}

// ─── Notification ────────────────────────────────────────────────────────────

export type NotificationType =
  | 'booking_request'
  | 'booking_approved'
  | 'booking_cancelled'
  | 'booking_confirmed'
  | 'booking_active'
  | 'booking_completed'
  | 'payment_received'
  | 'review_received'
  | 'system';

export interface Notification {
  id: string;
  notification_type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

// ─── API Helpers ─────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ApiError {
  error: string;
  field_errors?: Record<string, string[]>;
}
