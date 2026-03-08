'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import LoginModal from '@/app/components/LoginModal';
import { useAuth } from '@/app/context/AuthContext';

type ApplicationStatus =
  | 'pending'
  | 'revision'
  | 'rejected'
  | 'approved'
  | 'active'
  | null;

type HostLandingActionBarProps = {
  compact?: boolean;
  showStatusButton?: boolean;
};

export default function HostLandingActionBar({
  compact = false,
  showStatusButton = false,
}: HostLandingActionBarProps) {
  const router = useRouter();
  const { user, isHost, applicationStatus, isLoading } = useAuth();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

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
  const hasDashboardAccess = isHost || normalizedStatus === 'approved' || normalizedStatus === 'active';

  const primaryLabel = compact
    ? (
      hasDashboardAccess
        ? '호스트 대시보드'
        : normalizedStatus === 'revision'
          ? '지원서 수정하기'
          : hasApplication
            ? '신청현황'
            : '호스트 지원하기'
    )
    : (
      hasDashboardAccess
        ? '호스트 대시보드'
        : normalizedStatus === 'revision'
          ? '지원서 수정하기'
          : '호스트 지원하기'
    );

  const openLoginIfNeeded = () => {
    if (user) return false;
    setIsLoginModalOpen(true);
    return true;
  };

  const handlePrimaryClick = () => {
    if (isLoading) return;
    if (openLoginIfNeeded()) return;

    if (hasDashboardAccess) {
      router.push('/host/dashboard?tab=reservations');
      return;
    }

    if (compact && hasApplication) {
      router.push('/host/dashboard');
      return;
    }

    router.push('/host/register');
  };

  const handleStatusClick = () => {
    if (isLoading) return;
    if (openLoginIfNeeded()) return;

    router.push('/host/dashboard');
  };

  return (
    <>
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />

      <section className="bg-white">
        <div
          className={`mx-auto flex w-full max-w-[1440px] px-4 md:px-6 ${
            compact
              ? 'justify-center pt-2 pb-4 md:pt-3 md:pb-5'
              : 'justify-center py-5 md:py-6'
          }`}
        >
          <div
            className={`flex w-full items-center justify-center gap-2 ${
              compact ? 'max-w-[320px]' : 'max-w-[520px]'
            } ${compact ? 'flex-col' : 'flex-col md:flex-row'}`}
          >
            <button
              type="button"
              onClick={handlePrimaryClick}
              disabled={isLoading}
              className={`inline-flex items-center justify-center rounded-full bg-[#2f2f2f] text-white transition-colors hover:bg-[#242424] disabled:cursor-not-allowed disabled:opacity-60 ${
                compact
                  ? 'w-[164px] px-0 py-3 text-[14px] font-medium tracking-[-0.01em] md:w-[172px]'
                  : 'w-full px-5 py-3 text-[14px] font-medium tracking-[-0.01em] md:flex-1'
              }`}
            >
              {primaryLabel}
            </button>

            {showStatusButton && (
              <button
                type="button"
                onClick={handleStatusClick}
                disabled={isLoading}
                className="inline-flex w-full items-center justify-center rounded-full border border-black/10 bg-white px-5 py-3 text-[14px] font-medium tracking-[-0.01em] text-[#2f2f2f] transition-colors hover:border-black/15 hover:bg-[#f8f8f8] disabled:cursor-not-allowed disabled:opacity-60 md:flex-1"
              >
                신청현황
              </button>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
