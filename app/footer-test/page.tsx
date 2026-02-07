import React from 'react';
import SiteFooter from '@/app/components/SiteFooter';

export default function FooterTestPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* 본문 영역 (푸터가 바닥에 붙는지 확인용) */}
      <div className="flex-1 p-20 text-center space-y-4">
        <h1 className="text-3xl font-bold">푸터 디자인 테스트 페이지</h1>
        <p className="text-gray-500">스크롤을 아래로 내려서 푸터를 확인해보세요.</p>
        <div className="h-[500px] bg-white rounded-xl shadow-sm border border-gray-200 flex items-center justify-center">
           본문 내용이 들어가는 자리...
        </div>
      </div>

      {/* ✅ 여기서 푸터만 단독으로 테스트! */}
      <SiteFooter />
    </div>
  );
}