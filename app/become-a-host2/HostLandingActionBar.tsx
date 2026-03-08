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

const STATUS_META: Record<
  Exclude<ApplicationStatus, null>,
  { label: string; className: string }
> = {
  pending: {
    label: '신청 접수됨',
    className: 'border-[#e8ddc0] bg-[#f7f1df] text-[#7a6440]',
  },
  revision: {
    label: '보완 요청',
    className: 'border-[#eed7c7] bg-[#f8ede6] text-[#8a5a2b]',
  },
  rejected: {
    label: '검토 결과 확인',
    className: 'border-[#ecd1d1] bg-[#f8ecec] text-[#8a4b4b]',
  },
  approved: {
    label: '승인 완료',
    className: 'border-[#d9e6d8] bg-[#edf5ec] text-[#456548]',
  },
  active: {
    label: '운영 중',
    className: 'border-[#d9e6d8] bg-[#edf5ec] text-[#456548]',
  },
};

export default function HostLandingActionBar() {
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
  const statusMeta = normalizedStatus ? STATUS_META[normalizedStatus] : null;

  const primaryLabel = hasDashboardAccess
    ? '호스트 대시보드'
    : normalizedStatus === 'revision'
      ? '지원서 수정하기'
      : '호스트 지원하기';

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

      <section className="border-y border-black/8 bg-white">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6 md:py-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a816f]">
                Host Partnership
              </span>
              {statusMeta && (
                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-[-0.01em] ${statusMeta.className}`}
                >
                  {statusMeta.label}
                </span>
              )}
            </div>
            <p className="mt-2 text-[17px] font-medium tracking-[-0.03em] text-[#2f2f2f] md:text-[19px]">
              호스트 지원은 여기서 바로 시작하고, 신청 후 진행 상황은 대시보드에서 이어서 확인할 수 있습니다.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 md:w-auto md:min-w-[280px] md:flex-row md:justify-end">
            <button
              type="button"
              onClick={handlePrimaryClick}
              disabled={isLoading}
              className="inline-flex items-center justify-center rounded-full bg-[#2f2f2f] px-5 py-3 text-[14px] font-medium tracking-[-0.01em] text-white transition-colors hover:bg-[#242424] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {primaryLabel}
            </button>

            {hasApplication && (
              <button
                type="button"
                onClick={handleStatusClick}
                disabled={isLoading}
                className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-5 py-3 text-[14px] font-medium tracking-[-0.01em] text-[#2f2f2f] transition-colors hover:border-black/15 hover:bg-[#f8f8f8] disabled:cursor-not-allowed disabled:opacity-60"
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
