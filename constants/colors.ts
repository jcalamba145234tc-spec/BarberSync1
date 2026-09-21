export const Colors = {
  primary: '#111827',
  primaryLight: '#1F2937',
  accent: '#D4A537',
  background: '#F5F6F8',
  surface: '#FFFFFF',
  text: '#111827',
  textMuted: '#6B7280',
  border: '#E5E7EB',
  success: '#16A34A',
  warning: '#F59E0B',
  danger: '#DC2626',
  info: '#2563EB',
  cash: '#16A34A',
  gcash: '#2563EB',
};

export const StatusColors: Record<string, string> = {
  COMPLETED: Colors.success,
  PENDING_GCASH: Colors.warning,
  CANCELLED: Colors.danger,
  WAITING: Colors.warning,
  CALLED: Colors.info,
  IN_SERVICE: Colors.primary,
};
