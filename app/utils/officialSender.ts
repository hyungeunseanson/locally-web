export const OFFICIAL_SUPPORT_SENDER_NAME = 'Locally Support';

export function isOfficialSupportSenderDisplayName(actorDisplayName: string) {
  return actorDisplayName.trim() === OFFICIAL_SUPPORT_SENDER_NAME;
}
