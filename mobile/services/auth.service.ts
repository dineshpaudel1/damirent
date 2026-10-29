import api, { API_BASE_URL, tokenStorage } from './api';
import type {
  AuthTokens,
  IdentityVerification,
  LoginRequest,
  OTPRequest,
  OTPVerifyRequest,
  PasswordResetConfirmRequest,
  PasswordResetRequest,
  RegisterRequest,
  User,
  VerificationRequest,
} from '@/types';

export const authService = {
  async register(data: RegisterRequest): Promise<{ message: string; otp?: string }> {
    const res = await api.post('/auth/register/', data);
    return res.data;
  },

  async login(data: LoginRequest): Promise<AuthTokens & { user: User }> {
    const res = await api.post('/auth/login/', data);
    return res.data;
  },

  async logout(refresh: string): Promise<void> {
    await api.post('/auth/logout/', { refresh });
  },

  async refreshToken(refresh: string): Promise<{ access: string; refresh?: string }> {
    const res = await api.post('/auth/token/refresh/', { refresh });
    return res.data;
  },

  async sendOTP(data: OTPRequest): Promise<{ message: string; otp?: string }> {
    const res = await api.post('/auth/otp/send/', data);
    return res.data;
  },

  async verifyOTP(data: OTPVerifyRequest): Promise<{ message: string }> {
    const res = await api.post('/auth/otp/verify/', data);
    return res.data;
  },

  async initiatePasswordReset(data: PasswordResetRequest): Promise<{ message: string }> {
    const res = await api.post('/auth/password/reset/', data);
    return res.data;
  },

  async confirmPasswordReset(data: PasswordResetConfirmRequest): Promise<{ message: string }> {
    const res = await api.post('/auth/password/reset/confirm/', data);
    return res.data;
  },

  async getMe(): Promise<User> {
    const res = await api.get('/users/me/');
    return res.data;
  },

  async updateMe(data: Partial<Pick<User, 'full_name' | 'email'>>): Promise<User> {
    const res = await api.patch('/users/me/', data);
    return res.data;
  },

  async registerPushToken(token: string): Promise<void> {
    await api.post('/users/push-token/', { token });
  },

  // ── Profile photo ──────────────────────────────────────────────────────────

  async uploadProfilePhoto(uri: string): Promise<{ avatar: string }> {
    const formData = new FormData();
    const filename = uri.split('/').pop() ?? 'photo.jpg';
    const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg';
    const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    formData.append('photo', { uri, name: filename, type: mimeType } as unknown as Blob);

    const res = await api.post('/users/me/photo/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  async deleteProfilePhoto(): Promise<void> {
    await api.delete('/users/me/photo/');
  },

  // ── Identity verification ──────────────────────────────────────────────────

  async getVerificationStatus(): Promise<IdentityVerification> {
    const res = await api.get('/users/me/identity/');
    return res.data;
  },

  async submitIdentityDocuments(
    frontUri: string,
    backUri: string,
  ): Promise<IdentityVerification> {
    const formData = new FormData();

    const frontName = frontUri.split('/').pop() ?? 'front.jpg';
    const backName = backUri.split('/').pop() ?? 'back.jpg';

    const extOf = (name: string) => name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const mimeOf = (ext: string) =>
      ext === 'png' ? 'image/png' : ext === 'pdf' ? 'application/pdf' : 'image/jpeg';

    formData.append('id_front', {
      uri: frontUri,
      name: frontName,
      type: mimeOf(extOf(frontName)),
    } as unknown as Blob);
    formData.append('id_back', {
      uri: backUri,
      name: backName,
      type: mimeOf(extOf(backName)),
    } as unknown as Blob);

    const res = await api.post('/users/me/identity/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  /** Returns a URL + headers to load the user's own identity document in an Image component. */
  async getIdentityDocumentSource(side: 'front' | 'back') {
    const token = await tokenStorage.getAccess();
    return {
      uri: `${API_BASE_URL}/users/me/identity/document/${side}/`,
      headers: { Authorization: `Bearer ${token}` },
    };
  },

  // ── Admin: verification dashboard ─────────────────────────────────────────

  async getPendingVerifications(): Promise<VerificationRequest[]> {
    const res = await api.get('/users/verification/pending/');
    return res.data;
  },

  async approveVerification(userId: string): Promise<void> {
    await api.post(`/users/verification/${userId}/approve/`);
  },

  async rejectVerification(userId: string, rejectionReason: string): Promise<void> {
    await api.post(`/users/verification/${userId}/reject/`, {
      rejection_reason: rejectionReason,
    });
  },

  /** Returns source props for loading an identity document in the admin dashboard. */
  async getAdminDocumentSource(userId: string, side: 'front' | 'back') {
    const token = await tokenStorage.getAccess();
    return {
      uri: `${API_BASE_URL}/users/verification/${userId}/document/${side}/`,
      headers: { Authorization: `Bearer ${token}` },
    };
  },
};
