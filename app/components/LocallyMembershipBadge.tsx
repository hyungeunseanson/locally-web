'use client';

import type { LocallyMembershipStatus } from '@/app/utils/memberStatus';
import { useLanguage } from '@/app/context/LanguageContext';

type LocallyMembershipBadgeProps = {
  status: Exclude<LocallyMembershipStatus, 'none'>;
  className?: string;
  testId?: string;
};

export default function LocallyMembershipBadge({
  status,
  className = '',
  testId,
}: LocallyMembershipBadgeProps) {
  const { t } = useLanguage();
  const label = status === 'circle' ? t('locally_circle') : t('locally_member');

  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700 ${className}`.trim()}
    >
      {label}
    </span>
  );
}
