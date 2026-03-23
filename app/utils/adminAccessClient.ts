export type ClientAdminAccessResult = {
  success: boolean;
  isAdmin: boolean;
  userRole: string | null;
  isWhitelisted: boolean;
  userId: string | null;
  displayName: string | null;
};

export async function fetchAdminAccess(): Promise<ClientAdminAccessResult> {
  const response = await fetch('/api/admin/access', { cache: 'no-store' });

  if (!response.ok) {
    return {
      success: false,
      isAdmin: false,
      userRole: null,
      isWhitelisted: false,
      userId: null,
      displayName: null,
    };
  }

  const result = (await response.json()) as Partial<ClientAdminAccessResult> & { success?: boolean };

  if (!result?.success) {
    return {
      success: false,
      isAdmin: false,
      userRole: null,
      isWhitelisted: false,
      userId: null,
      displayName: null,
    };
  }

  return {
    success: true,
    isAdmin: Boolean(result.isAdmin),
    userRole: typeof result.userRole === 'string' ? result.userRole : null,
    isWhitelisted: Boolean(result.isWhitelisted),
    userId: typeof result.userId === 'string' ? result.userId : null,
    displayName: typeof result.displayName === 'string' ? result.displayName : null,
  };
}
