export function isMissingAnonymousColumnError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const message = 'message' in error && typeof error.message === 'string' ? error.message.toLowerCase() : '';
  if (!message.includes('is_anonymous')) return false;

  return message.includes('column') || message.includes('schema cache') || message.includes('could not find');
}
