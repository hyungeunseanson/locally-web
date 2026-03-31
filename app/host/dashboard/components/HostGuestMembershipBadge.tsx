'use client';

import { useLanguage } from '@/app/context/LanguageContext';
import type { LocallyMembershipStatus } from '@/app/utils/memberStatus';

type Props = {
  status: Extract<LocallyMembershipStatus, 'member' | 'circle'>;
  className?: string;
  testId?: string;
};

export default function HostGuestMembershipBadge({ status, className = '', testId }: Props) {
  const { t } = useLanguage();

  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 ${className}`}
    >
      {status === 'circle'
        ? t('host_guest_membership_circle_badge')
        : t('host_guest_membership_member_badge')}
    </span>
  );
}
