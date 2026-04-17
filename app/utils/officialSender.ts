export const OFFICIAL_SUPPORT_SENDER_NAME = 'Locally Support';
export const OFFICIAL_SUPPORT_EMAIL = 'locally.partners@gmail.com';

export function isOfficialSupportSenderDisplayName(actorDisplayName: string) {
  return actorDisplayName.trim() === OFFICIAL_SUPPORT_SENDER_NAME;
}
