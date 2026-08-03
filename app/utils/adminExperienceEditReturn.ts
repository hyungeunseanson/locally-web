const ADMIN_EXPERIENCE_RETURN_PATH = '/admin/dashboard';

export function getAdminExperienceReturnPath(value: string | null | undefined, experienceId: string) {
  const fallback = `${ADMIN_EXPERIENCE_RETURN_PATH}?tab=EXPS&experienceId=${encodeURIComponent(experienceId)}`;

  if (!value || !value.startsWith(`${ADMIN_EXPERIENCE_RETURN_PATH}?`)) {
    return fallback;
  }

  try {
    const parsed = new URL(value, 'https://locally.invalid');
    if (parsed.origin !== 'https://locally.invalid' || parsed.pathname !== ADMIN_EXPERIENCE_RETURN_PATH) {
      return fallback;
    }

    if (parsed.searchParams.get('tab')?.toUpperCase() !== 'EXPS') {
      return fallback;
    }

    parsed.searchParams.set('tab', 'EXPS');
    parsed.searchParams.set('experienceId', experienceId);
    return `${parsed.pathname}?${parsed.searchParams.toString()}`;
  } catch {
    return fallback;
  }
}
