'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import LoginModal from '@/app/components/LoginModal';
import { useAuth } from '@/app/context/AuthContext';
import { useLanguage } from '@/app/context/LanguageContext';

type ApplicationStatus =
  | 'pending'
  | 'revision'
  | 'rejected'
  | 'approved'
  | 'active'
  | null;

type HostLandingActionBarProps = {
  compact?: boolean;
};

export default function HostLandingActionBar({
  compact = false,
}: HostLandingActionBarProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const { user, isHost, applicationStatus, isLoading, refreshHostStatus } = useAuth();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    void refreshHostStatus();
  }, [refreshHostStatus, user?.id]);

  const normalizedStatus = useMemo<ApplicationStatus>(() => {
    const status = applicationStatus?.toLowerCase().trim();

    if (
      status === 'pending' ||
      status === 'revision' ||
      status === 'rejected' ||
      status === 'approved' ||
      status === 'active'
    ) {
      return status;
    }

    return null;
  }, [applicationStatus]);

  const hasApplication = normalizedStatus !== null;
  const shouldSwitchToHostMode =
    isHost || normalizedStatus === 'approved' || normalizedStatus === 'active';

  const primaryLabel = shouldSwitchToHostMode
    ? t('host_landing_cta_dashboard')
    : hasApplication
      ? t('host_landing_cta_status')
      : t('host_landing_cta_apply');

  const helperTitle = !user
    ? t('host_landing_helper_login_title')
    : shouldSwitchToHostMode
      ? t('host_landing_helper_dashboard_title')
      : normalizedStatus === 'pending'
        ? t('host_landing_helper_pending_title')
        : normalizedStatus === 'revision'
          ? t('host_landing_helper_revision_title')
          : normalizedStatus === 'rejected'
            ? t('host_landing_helper_rejected_title')
            : t('host_landing_helper_apply_title');

  const helperDesc = !user
    ? t('host_landing_helper_login_desc')
    : shouldSwitchToHostMode
      ? t('host_landing_helper_dashboard_desc')
      : normalizedStatus === 'pending'
        ? t('host_landing_helper_pending_desc')
        : normalizedStatus === 'revision'
          ? t('host_landing_helper_revision_desc')
          : normalizedStatus === 'rejected'
            ? t('host_landing_helper_rejected_desc')
            : t('host_landing_helper_apply_desc');

  const openLoginIfNeeded = () => {
    if (user) return false;
    setIsLoginModalOpen(true);
    return true;
  };

  const handlePrimaryClick = () => {
    if (isLoading) return;
    if (openLoginIfNeeded()) return;

    if (shouldSwitchToHostMode) {
      router.push('/host/dashboard?tab=reservations');
      return;
    }

    if (hasApplication) {
      router.push('/host/dashboard');
      return;
    }

    router.push('/host/register');
  };

  return (
    <>
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        redirectPath="/become-a-host"
      />

      <section className="bg-white">
        <div
          className={`mx-auto flex w-full max-w-[1440px] px-[7px] md:px-6 ${
            compact
              ? 'justify-center pt-2 pb-4 md:pt-3 md:pb-5'
              : 'justify-center py-5 md:py-6'
          }`}
        >
          <div
            className={`flex w-full max-w-[320px] flex-col items-center justify-center ${
              compact ? 'gap-0' : 'gap-2'
            }`}
          >
            <button
              data-testid="host-landing-primary-cta"
              type="button"
              onClick={handlePrimaryClick}
              disabled={isLoading}
              className="inline-flex w-[164px] items-center justify-center rounded-full bg-[#2f2f2f] px-0 py-3 text-[14px] font-medium tracking-[-0.01em] text-white transition-colors hover:bg-[#242424] disabled:cursor-not-allowed disabled:opacity-60 md:w-[172px]"
            >
              {primaryLabel}
            </button>
            {!compact && (
              <div
                data-testid="host-landing-status-hint"
                className="w-full rounded-2xl border border-[#E7E7E7] bg-[#FAFAFA] px-4 py-3 text-left"
              >
                <p className="text-[12px] font-semibold tracking-[-0.01em] text-[#2F2F2F]">
                  {helperTitle}
                </p>
                <p className="mt-1 text-[11px] leading-5 text-[#6B7280]">
                  {helperDesc}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
