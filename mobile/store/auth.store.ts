import { create } from 'zustand';
import { authService } from '@/services/auth.service';
import { tokenStorage } from '@/services/api';
import { queryClient } from '@/lib/queryClient';
import type { User, LoginRequest, RegisterRequest } from '@/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<{ otp?: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (data) => {
    const result = await authService.login(data);
    await tokenStorage.save(result.access, result.refresh);
    set({ user: result.user, isAuthenticated: true });
  },

  register: async (data) => {
    const result = await authService.register(data);
    return { otp: result.otp };
  },

  logout: async () => {
    const refresh = await tokenStorage.getRefresh();
    if (refresh) {
      try {
        await authService.logout(refresh);
      } catch {
        // Swallow logout errors — always clear local state
      }
    }
    await tokenStorage.clear();
    // Clear all cached query data so another user on the same device
    // cannot see stale data from the previous session.
    queryClient.clear();
    set({ user: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const access = await tokenStorage.getAccess();
      if (!access) {
        set({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }
      const user = await authService.getMe();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      await tokenStorage.clear();
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  refreshUser: async () => {
    try {
      const user = await authService.getMe();
      set({ user });
    } catch {
      // Silently fail; 401 will be caught by the api interceptor
    }
  },

  setUser: (user) => set({ user }),
}));

// Selector helpers
export const selectUser = (state: AuthState) => state.user;
export const selectIsAuthenticated = (state: AuthState) => state.isAuthenticated;
export const selectIsLoading = (state: AuthState) => state.isLoading;
