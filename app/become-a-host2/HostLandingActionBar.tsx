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
};

export default function HostLandingActionBar({
  compact = false,
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
  const shouldSwitchToHostMode =
    isHost || normalizedStatus === 'approved' || normalizedStatus === 'active';

  const primaryLabel = shouldSwitchToHostMode
    ? '호스트 모드로 전환'
    : hasApplication
      ? '신청현황'
      : '호스트 지원하기';

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
          </div>
        </div>
      </section>
    </>
  );
}
