export const OFFICIAL_SUPPORT_SENDER_NAME = 'Locally Support';
export const OFFICIAL_SUPPORT_EMAIL = 'locally.partners@gmail.com';
export const OFFICIAL_SUPPORT_AVATAR_SRC = '/images/logos/Frame%201545423142.png';

export function isOfficialSupportSenderDisplayName(actorDisplayName: string) {
  return actorDisplayName.trim() === OFFICIAL_SUPPORT_SENDER_NAME;
}
