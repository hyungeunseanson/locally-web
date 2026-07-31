'use client';

import MobileLanguageSwitcher from '@/app/components/mobile/MobileLanguageSwitcher';

export default function HostLandingMobileHeader() {
  return (
    <header
      data-testid="host-landing-mobile-header"
      className="sticky top-0 z-[90] border-b border-slate-100 bg-white pt-[env(safe-area-inset-top)] md:hidden"
    >
      <div className="flex h-14 items-center justify-end px-3">
        <div className="flex h-10 w-10 items-center justify-end">
          <MobileLanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
