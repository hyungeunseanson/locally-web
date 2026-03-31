'use client';

import type { LocallyMembershipStatus } from '@/app/utils/memberStatus';
import { useLanguage } from '@/app/context/LanguageContext';

type LocallyMembershipBadgeProps = {
  status: Exclude<LocallyMembershipStatus, 'none'>;
  className?: string;
  testId?: string;
  size?: 'default' | 'compact';
};

export default function LocallyMembershipBadge({
  status,
  className = '',
  testId,
  size = 'default',
}: LocallyMembershipBadgeProps) {
  const { t } = useLanguage();
  const label = status === 'circle' ? t('locally_circle') : t('locally_member');
  const sizeClass =
    size === 'compact' ? 'px-2 py-0.5 text-[10px] leading-none' : 'px-2.5 py-1 text-xs leading-none';

  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center rounded-full border border-[#D9C38A] bg-[linear-gradient(135deg,#FFF8E6,#F5E7C1)] font-bold tracking-[0.01em] text-[#5B4520] shadow-[0_4px_12px_rgba(91,69,32,0.08)] ${sizeClass} ${className}`.trim()}
    >
      {label}
    </span>
  );
}
