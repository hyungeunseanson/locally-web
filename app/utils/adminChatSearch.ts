export const ADMIN_CHAT_SEARCH_DEBOUNCE_MS = 400;
export const ADMIN_CHAT_SEARCH_MIN_LENGTH = 2;
export const ADMIN_CHAT_SEARCH_MAX_LENGTH = 100;
export const ADMIN_CHAT_SEARCH_LIMIT = 25;
export type AdminChatSearchSurface = 'support' | 'phone';
export type AdminChatSearchResult = {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  title: string | null;
};
