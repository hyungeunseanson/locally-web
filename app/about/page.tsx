'use client';

import React, { useEffect, useState, useRef } from 'react';

// ---------------------------------------------------------
// ✅ [내부 컴포넌트] 숫자가 카운트업되는 애니메이션 컴포넌트
// 라이브러리 없이 부드러운 숫자 증가 효과를 구현합니다.
// ---------------------------------------------------------
function AnimatedCounter({ target, suffix = '' }: { target: number, suffix?: string }) {
  const [count, setCount] = useState(0);
  const elementRef = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false); // 한 번만 실행되도록

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          
          let start = 0;
          // 목표치가 클수록 빠르게 증가 (2초 동안 진행)
          const increment = target / (2000 / 30); 
          
          const timer = setInterval(() => {
            start += increment;
            if (start >= target) {
              setCount(target);
              clearInterval(timer);
            } else {
              setCount(Math.ceil(start));
            }
          }, 30); // 30ms마다 업데이트

          // 컴포넌트 언마운트 시 타이머 정리
          return () => clearInterval(timer);
        }
      },
      { threshold: 0.5 } // 50% 이상 보일 때 시작
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => {
      if (elementRef.current) observer.unobserve(elementRef.current);
    };
  }, [target]);

  return (
    <span ref={elementRef} className="tabular-nums">
      {/* 1000 단위 콤마 표시 및 접미사(+, k 등) 추가 */}
      {count.toLocaleString()}{suffix}
    </span>
  );
}


// ---------------------------------------------------------
// ✅ [메인 페이지] About Us 페이지 레이아웃
// ---------------------------------------------------------
export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      
      {/* 메인 섹션 (이미지 참고 레이아웃) */}
      <section className="flex flex-col md:flex-row w-full min-h-[90vh]">
        
        {/* [왼쪽] 텍스트 및 통계 영역 */}
        <div className="w-full md:w-1/2 p-10 md:p-20 flex flex-col justify-center bg-white z-10">
          {/* 뱃지 */}
          <div className="inline-block bg-blue-100 text-blue-600 px-4 py-1.5 rounded-full text-sm font-bold mb-8 self-start">
            OUR MISSION
          </div>
          
          {/* 메인 타이틀 */}
          <h1 className="text-4xl md:text-6xl font-black mb-8 leading-tight text-slate-900">
            우리는 여행의 방식을<br /> 
            <span className="text-blue-600">변화시키고 있습니다.</span>
          </h1>
          
          {/* 설명 텍스트 */}
          <p className="text-lg text-slate-600 mb-16 leading-relaxed max-w-xl">
            Locally는 단순한 플랫폼이 아닙니다. 우리는 여행자와 현지인을 연결하여, 
            가이드북 너머의 진짜 세상을 경험하게 합니다. 
            당신의 여정이 더 깊고 의미 있기를 바랍니다.
          </p>
          
          {/* ✅ [통계 섹션] 숫자가 움직이는 부분 */}
          <div className="grid grid-cols-3 gap-8 border-t border-slate-100 pt-10">
            {/* 통계 1 */}
            <div>
              <div className="text-4xl md:text-5xl font-black text-slate-900 mb-2">
                <AnimatedCounter target={50} suffix="+" />
              </div>
              <div className="text-sm font-bold text-slate-500 uppercase tracking-wider">Cities</div>
            </div>
            {/* 통계 2 */}
            <div>
              <div className="text-4xl md:text-5xl font-black text-slate-900 mb-2">
                <AnimatedCounter target={2400} />
              </div>
              <div className="text-sm font-bold text-slate-500 uppercase tracking-wider">Hosts</div>
            </div>
            {/* 통계 3 (k 단위 표현을 위해 target은 숫자, suffix는 k+) */}
            <div>
              <div className="text-4xl md:text-5xl font-black text-slate-900 mb-2">
                <AnimatedCounter target={18} suffix="k+" />
              </div>
              <div className="text-sm font-bold text-slate-500 uppercase tracking-wider">Trips</div>
            </div>
          </div>
        </div>
        
        {/* [오른쪽] 대형 이미지 영역 */}
        <div 
          className="w-full md:w-1/2 min-h-[50vh] md:min-h-full bg-cover bg-center relative"
          style={{
            // 이미지 출처: Unsplash (요청하신 이미지와 유사한 밝고 활기찬 분위기)
            backgroundImage: `url('https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2071&auto=format&fit=crop')`
          }}
        >
          {/* 이미지 위에 살짝 어두운 레이어를 덮어 텍스트가 있다면 더 잘 보이게 함 (선택사항) */}
          {/* <div className="absolute inset-0 bg-black/10"></div> */}
        </div>
      </section>

      {/* (선택사항) 추가 섹션이 필요하면 여기에 작성 */}
    </div>
  );
}