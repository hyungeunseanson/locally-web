function hasMissingColumnMessage(error: unknown, columnName: string): boolean {
  if (!error || typeof error !== 'object') return false;

  const message = 'message' in error && typeof error.message === 'string' ? error.message.toLowerCase() : '';
  if (!message.includes(columnName.toLowerCase())) return false;

  return message.includes('column') || message.includes('schema cache') || message.includes('could not find');
}

export function isMissingAnonymousColumnError(error: unknown): boolean {
  return hasMissingColumnMessage(error, 'is_anonymous');
}

export function isMissingCommunityModelColumnError(error: unknown): boolean {
  return (
    hasMissingColumnMessage(error, 'destination_hub')
    || hasMissingColumnMessage(error, 'post_format')
    || hasMissingColumnMessage(error, 'source_locale')
  );
}
