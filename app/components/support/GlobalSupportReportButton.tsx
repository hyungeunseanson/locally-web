'use client';

import { AlertCircle } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';

import { useLanguage } from '@/app/context/LanguageContext';
import { getSupportInquiryCopy } from './supportInquiryCopy';
import SupportInquiryFlow from './SupportInquiryFlow';

export function shouldHideGlobalSupportReport(pathname: string | null | undefined) {
  if (!pathname) return true;
  return (
    pathname.startsWith('/help') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/auth')
  );
}

export function getGlobalSupportReportMobilePosition(
  pathname: string,
  hostDashboardTab?: string | null
) {
  if (
    pathname.startsWith('/guest/inbox') ||
    (pathname.startsWith('/host/dashboard') && hostDashboardTab === 'inquiries')
  ) {
    return 'bottom-[156px]';
  }

  if (pathname.startsWith('/community')) {
    return 'bottom-[144px]';
  }

  if (
    pathname.startsWith('/services/intro') ||
    pathname.startsWith('/services/request') ||
    pathname.includes('/payment') ||
    pathname.startsWith('/host/create') ||
    pathname.startsWith('/host/register') ||
    pathname.startsWith('/host/experiences/')
  ) {
    return 'bottom-[112px]';
  }

  return 'bottom-[88px]';
}

export default function GlobalSupportReportButton() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { lang } = useLanguage();

  if (shouldHideGlobalSupportReport(pathname)) return null;

  const copy = getSupportInquiryCopy(lang);
  const mobilePosition = getGlobalSupportReportMobilePosition(
    pathname || '/',
    searchParams.get('tab')
  );

  return (
    <SupportInquiryFlow>
      {({ openInquiry }) => (
        <button
          type="button"
          data-testid="global-support-report-trigger"
          onClick={openInquiry}
          aria-label={copy.reportButtonLabel}
          className={`fixed right-4 z-[90] inline-flex min-h-11 items-center gap-1.5 rounded-full border border-slate-200 bg-white/95 px-3 py-2 text-[11px] font-semibold text-slate-800 shadow-[0_10px_28px_rgba(15,23,42,0.18)] backdrop-blur transition hover:bg-slate-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 md:bottom-6 md:right-6 md:min-h-12 md:px-4 md:text-[13px] ${mobilePosition}`}
        >
          <AlertCircle size={17} aria-hidden="true" />
          <span>{copy.reportButtonLabel}</span>
        </button>
      )}
    </SupportInquiryFlow>
  );
}
