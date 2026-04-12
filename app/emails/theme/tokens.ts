export const EMAIL_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", Arial, sans-serif';

export const emailColors = {
  canvas: '#F7F7F7',
  surface: '#FFFFFF',
  subtle: '#F8FAFC',
  softAccent: '#FFF3F5',
  strongText: '#222222',
  defaultText: '#374151',
  mutedText: '#6B7280',
  softText: '#94A3B8',
  border: '#E5E7EB',
  brandPrimary: '#FF385C',
  brandPrimaryHover: '#D90B3E',
  successBg: '#ECFDF5',
  successText: '#166534',
  warningBg: '#FFFBEB',
  warningText: '#92400E',
  dangerBg: '#FEF2F2',
  dangerText: '#991B1B',
} as const;

export const emailSpacing = {
  outerDesktop: '24px',
  outerMobile: '16px',
  contentDesktop: '24px',
  contentMobile: '18px',
  sectionDesktop: '18px',
  sectionMobile: '14px',
  itemDesktop: '10px',
  itemMobile: '8px',
} as const;

export const emailTypography = {
  titleDesktop: '24px',
  titleMobile: '22px',
  body: '14px',
  label: '12px',
  footer: '11px',
  bodyLineHeight: '1.62',
} as const;

export const emailRadii = {
  container: '18px',
  card: '14px',
  button: '10px',
  pill: '999px',
} as const;

export const emailShadows = {
  container: '0 8px 24px rgba(15, 23, 42, 0.06)',
} as const;

export const EMAIL_MAX_WIDTH = 600;
