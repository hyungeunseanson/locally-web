'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  // 컴포넌트가 리렌더링되어도 QueryClient 인스턴스가 유지되도록 useState 사용
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5분 동안 데이터를 캐싱 (불필요한 DB 호출 방지)
        refetchOnWindowFocus: false, // 탭 전환 시 매번 새로고침 방지
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}