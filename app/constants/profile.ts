export const PROFILE_LANGUAGE_OPTIONS = [
  'English',
  'Korean',
  'Japanese',
  'Chinese',
  'Spanish',
  'French',
] as const;

export type ProfileLanguageOption = (typeof PROFILE_LANGUAGE_OPTIONS)[number];
