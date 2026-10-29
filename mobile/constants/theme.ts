export const Colors = {
  // Brand colors extracted from logo
  primary: '#2B3990',       // Logo deep blue
  primaryLight: '#4A5BC4',  // Lighter blue
  primaryDark: '#1E2870',   // Darker blue
  primarySurface: '#ECEFFE', // Very light blue tint

  secondary: '#F47B20',       // Logo vivid orange
  secondaryLight: '#F9A55E',  // Lighter orange
  secondarySurface: '#FEF3EA', // Very light orange tint

  success: '#22C55E',
  successSurface: '#F0FDF4',

  error: '#EF4444',
  errorSurface: '#FEF2F2',

  warning: '#F59E0B',
  warningSurface: '#FFFBEB',

  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceSecondary: '#F1F5F9',

  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#94A3B8',
  textInverse: '#FFFFFF',
  textDisabled: '#CBD5E1',

  border: '#E2E8F0',
  borderFocus: '#2B3990',
  borderError: '#EF4444',

  overlay: 'rgba(15, 23, 42, 0.5)',
  skeleton: '#E2E8F0',

  tabBar: '#FFFFFF',
  tabBarBorder: '#E2E8F0',
  tabBarActive: '#2B3990',
  tabBarInactive: '#94A3B8',

  statusPending: '#F59E0B',
  statusPendingSurface: '#FFFBEB',
  statusApproved: '#3B82F6',
  statusApprovedSurface: '#EFF6FF',
  statusConfirmed: '#8B5CF6',
  statusConfirmedSurface: '#F5F3FF',
  statusActive: '#22C55E',
  statusActiveSurface: '#F0FDF4',
  statusCompleted: '#64748B',
  statusCompletedSurface: '#F8FAFC',
  statusCancelled: '#EF4444',
  statusCancelledSurface: '#FEF2F2',
  statusDisputed: '#DC2626',
  statusDisputedSurface: '#FEF2F2',
} as const;

export const Typography = {
  fontFamily: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semiBold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
  fontSize: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 32,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
} as const;

export const Radius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  full: 9999,
} as const;

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
} as const;
