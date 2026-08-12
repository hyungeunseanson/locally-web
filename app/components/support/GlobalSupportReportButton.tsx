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
          className={`fixed right-4 z-[90] inline-flex min-h-9 items-center gap-1 rounded-full border border-slate-700 bg-slate-900/95 px-2.5 py-1.5 text-[10px] font-semibold text-white shadow-[0_8px_22px_rgba(15,23,42,0.28)] backdrop-blur transition after:absolute after:-inset-1 after:content-[''] hover:bg-slate-950 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 md:bottom-6 md:right-6 md:min-h-10 md:px-3 md:text-[11px] ${mobilePosition}`}
        >
          <AlertCircle size={14} aria-hidden="true" />
          <span>{copy.reportButtonLabel}</span>
        </button>
      )}
    </SupportInquiryFlow>
  );
}
