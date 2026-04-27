export const EMAIL_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", Arial, sans-serif';

export const emailColors = {
  canvas: '#FFFFFF',
  desktopCanvas: '#F7F7F7',
  surface: '#FFFFFF',
  subtle: '#FAFAFA',
  glassSurface: '#FFFFFF',
  glassBorder: '#E8E8E8',
  glassHighlight: '#FFFFFF',
  softAccent: '#FFF3F5',
  strongText: '#222222',
  defaultText: '#333333',
  mutedText: '#767676',
  softText: '#9CA3AF',
  border: '#E8E8E8',
  rowBorder: '#F0F0F0',
  brandPrimary: '#FF385C',
  brandPrimaryHover: '#D90B3E',
  ctaBackground: '#111111',
  ctaBackgroundHover: '#222222',
  successBg: '#F5F5F5',
  successText: '#222222',
  warningBg: '#FFFBEB',
  warningText: '#92400E',
  dangerBg: '#FEF2F2',
  dangerText: '#991B1B',
} as const;

export const emailSpacing = {
  outerDesktop: '24px',
  outerMobile: '0',
  contentDesktop: '32px',
  contentMobile: '20px',
  sectionDesktop: '24px',
  sectionMobile: '20px',
  itemDesktop: '14px',
  itemMobile: '14px',
} as const;

export const emailTypography = {
  titleDesktop: '24px',
  titleMobile: '24px',
  body: '14px',
  label: '11px',
  footer: '11px',
  bodyLineHeight: '1.6',
} as const;

export const emailRadii = {
  container: '20px',
  card: '14px',
  button: '10px',
  pill: '999px',
} as const;

export const emailShadows = {
  container: '0 12px 36px rgba(15, 23, 42, 0.05)',
  panel: 'none',
} as const;

export const EMAIL_MAX_WIDTH = 600;
