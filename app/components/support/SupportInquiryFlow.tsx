'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import LoginModal from '@/app/components/LoginModal';
import { useAuth } from '@/app/context/AuthContext';
import SupportInquiryModal from './SupportInquiryModal';
import {
  clearExpiredSupportReportPending,
  clearSupportReportPending,
  consumeSupportReportPending,
  markSupportReportPending,
} from './supportReportPending';

type SupportInquiryFlowProps = {
  children: (controls: { openInquiry: () => void }) => ReactNode;
};

export default function SupportInquiryFlow({ children }: SupportInquiryFlowProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isInquiryOpen, setIsInquiryOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  const currentPath = (() => {
    const query = searchParams.toString();
    return `${pathname || '/'}${query ? `?${query}` : ''}`;
  })();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    clearExpiredSupportReportPending(window.sessionStorage);
  }, []);

  useEffect(() => {
    if (isLoading || !user || typeof window === 'undefined') return;
    if (consumeSupportReportPending(window.sessionStorage)) {
      const openTimer = window.setTimeout(() => {
        setIsLoginOpen(false);
        setIsInquiryOpen(true);
      }, 0);
      return () => window.clearTimeout(openTimer);
    }
  }, [isLoading, user]);

  const requestLogin = useCallback(() => {
    if (typeof window !== 'undefined') {
      markSupportReportPending(window.sessionStorage);
    }
    setIsLoginOpen(true);
  }, []);

  const openInquiry = useCallback(() => {
    if (user) {
      setIsInquiryOpen(true);
      return;
    }
    requestLogin();
  }, [requestLogin, user]);

  const handleLoginClose = useCallback(() => {
    if (typeof window !== 'undefined') {
      clearSupportReportPending(window.sessionStorage);
    }
    setIsLoginOpen(false);
    setIsInquiryOpen(false);
  }, []);

  const handleLoginSuccess = useCallback(() => {
    if (typeof window !== 'undefined') {
      clearSupportReportPending(window.sessionStorage);
    }
    setIsLoginOpen(false);
    setIsInquiryOpen(true);
  }, []);

  const handleUnauthorized = useCallback(() => {
    requestLogin();
  }, [requestLogin]);

  const handleInquiryClose = useCallback(() => {
    setIsInquiryOpen(false);
  }, []);

  return (
    <>
      {children({ openInquiry })}
      <SupportInquiryModal
        isOpen={isInquiryOpen && !isLoginOpen}
        onClose={handleInquiryClose}
        onUnauthorized={handleUnauthorized}
        onSubmitted={(redirectUrl) => router.push(redirectUrl)}
      />
      <LoginModal
        isOpen={isLoginOpen}
        onClose={handleLoginClose}
        onLoginSuccess={handleLoginSuccess}
        redirectPath={currentPath}
      />
    </>
  );
}
