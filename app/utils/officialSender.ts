export const OFFICIAL_SUPPORT_SENDER_NAME = 'Locally Support';
export const OFFICIAL_PUBLIC_EMAIL = 'hello@locally-travel.com';
export const OFFICIAL_SUPPORT_EMAIL = 'support@locally-travel.com';
export const OFFICIAL_SUPPORT_AVATAR_SRC = '/images/logos/Frame%201545423142.png';

export function isOfficialSupportSenderDisplayName(actorDisplayName: string) {
  return actorDisplayName.trim() === OFFICIAL_SUPPORT_SENDER_NAME;
}
