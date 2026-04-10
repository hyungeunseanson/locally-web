export const EMAIL_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", Arial, sans-serif';

export const emailColors = {
  canvas: '#F7F7F7',
  surface: '#FFFFFF',
  subtle: '#F8FAFC',
  strongText: '#222222',
  defaultText: '#374151',
  mutedText: '#6B7280',
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
  outerDesktop: '40px',
  outerMobile: '24px',
  contentDesktop: '32px',
  contentMobile: '20px',
  sectionDesktop: '24px',
  sectionMobile: '16px',
  itemDesktop: '12px',
  itemMobile: '8px',
} as const;

export const emailTypography = {
  titleDesktop: '28px',
  titleMobile: '24px',
  body: '15px',
  label: '12px',
  footer: '11px',
  bodyLineHeight: '1.6',
} as const;

export const emailRadii = {
  container: '20px',
  card: '16px',
  button: '12px',
  pill: '999px',
} as const;

export const emailShadows = {
  container: '0 10px 30px rgba(15, 23, 42, 0.08)',
} as const;

export const EMAIL_MAX_WIDTH = 600;
