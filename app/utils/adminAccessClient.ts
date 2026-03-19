export type ClientAdminAccessResult = {
  isAdmin: boolean;
  userRole: string | null;
  isWhitelisted: boolean;
};

export async function fetchAdminAccess(): Promise<ClientAdminAccessResult> {
  const response = await fetch('/api/admin/access', { cache: 'no-store' });

  if (!response.ok) {
    return {
      isAdmin: false,
      userRole: null,
      isWhitelisted: false,
    };
  }

  const result = (await response.json()) as Partial<ClientAdminAccessResult> & { success?: boolean };

  if (!result?.success) {
    return {
      isAdmin: false,
      userRole: null,
      isWhitelisted: false,
    };
  }

  return {
    isAdmin: Boolean(result.isAdmin),
    userRole: typeof result.userRole === 'string' ? result.userRole : null,
    isWhitelisted: Boolean(result.isWhitelisted),
  };
}
