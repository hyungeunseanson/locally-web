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
    pathname.startsWith('/auth') ||
    pathname.startsWith('/host/create') ||
    pathname.startsWith('/host/register') ||
    pathname.startsWith('/host/experiences/')
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
    pathname.includes('/payment')
  ) {
    return 'bottom-[120px]';
  }

  return 'bottom-[96px]';
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
          className={`fixed right-4 z-[90] inline-flex min-h-[30px] items-center gap-1 rounded-full border border-slate-700 bg-slate-900/95 px-2 py-1 text-[9px] font-semibold text-white shadow-[0_8px_22px_rgba(15,23,42,0.28)] backdrop-blur transition after:absolute after:-inset-1 after:content-[''] hover:bg-slate-950 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 md:bottom-7 md:right-5 md:min-h-8 md:px-2.5 md:py-1 md:text-[10px] ${mobilePosition}`}
        >
          <AlertCircle size={12} aria-hidden="true" />
          <span>{copy.reportButtonLabel}</span>
        </button>
      )}
    </SupportInquiryFlow>
  );
}
