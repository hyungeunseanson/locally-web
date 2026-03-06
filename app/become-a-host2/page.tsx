'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Calendar,
  ChevronDown,
  CheckCircle2,
  Compass,
  Globe,
  MessageCircle,
  MoonStar,
  Palette,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Trees,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import LoginModal from '@/app/components/LoginModal';
import { createClient } from '@/app/utils/supabase/client';

const hostStories = [
  {
    title: '교토 골목의 아침을 소개하는 사치 님',
    subtitle: 'Neighborhood Walk',
    image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=900&auto=format&fit=crop',
  },
  {
    title: '오사카의 밤과 식문화를 연결하는 카나 님',
    subtitle: 'Local Dining',
    image: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?q=80&w=900&auto=format&fit=crop',
  },
  {
    title: '도쿄 빈티지 취향을 큐레이션하는 유스케 님',
    subtitle: 'Vintage Hunt',
    image: 'https://images.unsplash.com/photo-1554797589-7241bb691973?q=80&w=900&auto=format&fit=crop',
  },
];

const experienceCategories = [
  {
    icon: Compass,
    title: '내가 사는 도시의 매력 소개',
    description: '랜드마크를 넘어, 내가 오래 살아서 알게 된 골목과 리듬을 여행자에게 소개해보세요.',
  },
  {
    icon: UtensilsCrossed,
    title: '맛있는 음식을 함께 나누는 체험',
    description: '빵집, 시장, 이자카야, 쿠킹 클래스처럼 도시의 취향을 가장 쉽게 전하는 방식입니다.',
  },
  {
    icon: Trees,
    title: '자연 속에서 즐기는 로컬 액티비티',
    description: '도시 밖의 산책길, 바다, 공원처럼 오래 기억에 남는 속도와 풍경을 안내할 수 있습니다.',
  },
  {
    icon: Palette,
    title: '아트와 원데이 클래스',
    description: '공방, 전시, 창작 수업처럼 호스트의 감각이 직접 드러나는 체험을 만들 수 있습니다.',
  },
  {
    icon: MoonStar,
    title: '밤의 로컬 무드',
    description: '야경, 바, 심야 산책, 늦은 식사처럼 밤에만 열리는 도시의 분위기를 여행자와 나눠보세요.',
  },
];

const stats = [
  { label: '활성 호스트', value: '800+', note: '현재 운영 중인 로컬리 호스트' },
  { label: '평균 평점', value: '4.9', note: '게스트 만족도를 바탕으로 한 평균' },
  { label: '운영 도시', value: '5', note: '서울, 도쿄, 교토, 오사카, 홋카이도' },
];

const placementCards = [
  {
    title: '여행을 계획하는 순간부터 노출',
    description: '도시를 찾는 게스트가 체험을 탐색할 때, 로컬리의 감도 있는 체험이 먼저 보이도록 구성합니다.',
    badge: 'Before the trip',
    image: 'https://images.unsplash.com/photo-1480796927426-f609979314bd?q=80&w=1200&auto=format&fit=crop',
  },
  {
    title: '현지에 도착한 뒤에도 다시 추천',
    description: '단순 검색 결과가 아니라, 지금 이 도시에서 해볼 만한 경험으로 체험을 다시 연결합니다.',
    badge: 'During the trip',
    image: 'https://images.unsplash.com/photo-1532236204992-f5e85c024202?q=80&w=1200&auto=format&fit=crop',
  },
];

const hostTools = [
  {
    icon: Calendar,
    title: '예약 관리',
    description: '시간대별로 예약을 받고, 인원과 일정을 한 번에 정리할 수 있습니다.',
  },
  {
    icon: MessageCircle,
    title: '게스트와 메시지',
    description: '예약 전 문의부터 일정 안내까지, 앱 안에서 자연스럽게 이어집니다.',
  },
  {
    icon: ShieldCheck,
    title: '안전한 결제 흐름',
    description: '게스트 결제와 정산 흐름을 플랫폼이 관리해 호스팅에 집중할 수 있습니다.',
  },
  {
    icon: Users,
    title: '리뷰와 신뢰도 축적',
    description: '좋은 후기와 평점이 다음 예약으로 이어지도록 호스트 프로필에 신뢰를 쌓습니다.',
  },
];

const faqs = [
  {
    question: '꼭 전문 가이드여야 하나요?',
    answer: '아닙니다. 로컬리는 자격증보다 현지에 대한 감각과 호스트만의 시선을 더 중요하게 봅니다. 다만 특정 전문성이 필요한 체험이라면 소개에 분명히 적어주세요.',
  },
  {
    question: '외국어를 아주 잘해야 하나요?',
    answer: '기본적인 소통이 가능하면 충분합니다. 번역 앱과 사전 안내 메시지를 함께 활용해도 되고, 중요한 건 게스트를 편하게 맞이하는 태도입니다.',
  },
  {
    question: '정산은 어떻게 진행되나요?',
    answer: '예약과 결제가 완료된 뒤, 체험 운영 내역에 따라 플랫폼 정산 흐름으로 이어집니다. 호스트는 복잡한 개별 입금 관리 대신 운영에 집중할 수 있습니다.',
  },
  {
    question: '어떤 체험이 잘 어울리나요?',
    answer: '동네 산책, 미식 투어, 빈티지 쇼핑, 클래스, 야간 무드 체험처럼 “내가 실제로 좋아하는 것”이 잘 드러나는 체험이 가장 강합니다.',
  },
];

export default function BecomeHost2Page() {
  const [hasApplication, setHasApplication] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const checkStatus = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('host_applications')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (data) {
        setHasApplication(true);
      }
    };

    checkStatus();
  }, [supabase]);

  const handleStartClick = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setIsLoginModalOpen(true);
      return;
    }

    const { data } = await supabase
      .from('host_applications')
      .select('status')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (data) {
      router.push('/host/dashboard');
    } else {
      router.push('/host/register');
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfbf8] text-[#222222] selection:bg-rose-100">
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />

      <header className="sticky top-0 z-40 border-b border-black/5 bg-[#fcfbf8]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1280px] items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2">
            <img
              src="/images/logo.png"
              alt="Locally"
              className="h-10 w-10 object-contain mix-blend-multiply grayscale contrast-200"
            />
            <div className="leading-none">
              <div className="text-[18px] font-black tracking-tight">Locally</div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-[#8b8b8b]">Host Experiences</div>
            </div>
          </Link>

          <button
            onClick={handleStartClick}
            className="inline-flex items-center gap-2 rounded-full bg-[#222222] px-5 py-3 text-sm font-bold text-white transition hover:bg-black"
          >
            {hasApplication ? '내 신청 현황 확인' : '시작하기'}
          </button>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-[1280px] gap-10 px-4 pb-16 pt-10 md:px-6 md:pb-24 md:pt-16 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-16">
          <div className="max-w-xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500 shadow-sm">
              <Sparkles size={14} className="text-rose-500" />
              Locally Host Program
            </div>
            <h1 className="text-[40px] font-[900] leading-[0.98] tracking-tight text-[#111111] md:text-[76px]">
              좋아하는 일로
              <br />
              여행을
              <br />
              수입으로
              <br />
              바꾸세요
            </h1>
            <p className="mt-6 max-w-lg text-[16px] leading-relaxed text-[#5f5f5f] md:text-[21px]">
              수많은 게스트가 찾는 로컬 감도는 거창한 관광지가 아니라, 오래 살아본 사람만 아는 취향에서 시작됩니다. 당신의 도시를 로컬리에서 체험으로 만들어보세요.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={handleStartClick}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#222222] px-6 py-4 text-[15px] font-bold text-white transition hover:-translate-y-0.5 hover:bg-black"
              >
                {hasApplication ? '내 신청 현황 확인' : '시작하기'}
                <ArrowRight size={18} />
              </button>
              <Link
                href="/become-a-host"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-stone-300 bg-white px-6 py-4 text-[15px] font-bold text-[#222222] transition hover:border-[#222222]"
              >
                기존 호스트 페이지 보기
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-x-6 -bottom-8 h-32 rounded-full bg-rose-200/60 blur-3xl md:inset-x-10" />
            <div className="relative overflow-hidden rounded-[36px] bg-[#222222] shadow-[0_30px_100px_rgba(15,23,42,0.18)]">
              <img
                src="https://images.unsplash.com/photo-1527631746610-bca00a040d60?q=80&w=1400&auto=format&fit=crop"
                alt="로컬 호스트가 여행자와 도시를 함께 걷는 모습"
                className="h-[520px] w-full object-cover md:h-[700px]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute left-5 top-5 rounded-[24px] bg-white/90 px-4 py-3 shadow-lg backdrop-blur md:left-7 md:top-7">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
                    <Search size={20} />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-400">Guest View</div>
                    <div className="text-sm font-bold text-[#222222]">서울에서 이런 체험을 찾고 있어요</div>
                  </div>
                </div>
              </div>
              <div className="absolute bottom-5 left-5 right-5 rounded-[28px] bg-white/92 p-5 shadow-2xl backdrop-blur md:bottom-7 md:left-7 md:right-7 md:p-6">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-400">Featured Experience</div>
                    <h2 className="mt-1 text-[22px] font-[900] leading-tight text-[#222222] md:text-[28px]">
                      건축가와 함께 걷는
                      <br />
                      북촌의 느린 오후
                    </h2>
                  </div>
                  <div className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-bold text-[#222222]">₩45,000 / 인</div>
                </div>
                <p className="text-sm leading-relaxed text-[#6f6f6f] md:text-[15px]">
                  동네의 구조와 이야기, 오래된 상점, 숨은 골목까지. 여행자가 혼자서는 지나치기 쉬운 디테일을 호스트의 시선으로 안내합니다.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {['소규모', '현지 산책', '로컬 큐레이션'].map((tag) => (
                    <span key={tag} className="rounded-full bg-stone-100 px-3 py-1 text-[12px] font-semibold text-stone-600">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1080px] px-4 py-8 text-center md:px-6 md:py-12">
          <h2 className="text-[32px] font-[900] leading-tight tracking-tight text-[#171717] md:text-[52px]">
            로컬리가 찾는 건
            <br />
            관광 코스가 아니라 취향입니다
          </h2>
          <p className="mx-auto mt-5 max-w-3xl text-[16px] leading-relaxed text-[#6b6b6b] md:text-[20px]">
            로컬리에서는 많은 호스트가 “내가 좋아하는 도시를 어떻게 소개할까”라는 감각으로 체험을 만듭니다. 여행자를 데려다주는 사람이 아니라, 현지의 리듬을 안내하는 호스트를 찾습니다.
          </p>
        </section>

        <section className="mx-auto max-w-[1280px] px-4 py-8 md:px-6 md:py-12">
          <div className="grid gap-4 md:grid-cols-3 md:gap-5">
            {hostStories.map((story) => (
              <article key={story.title} className="group relative overflow-hidden rounded-[30px] bg-[#222222]">
                <img
                  src={story.image}
                  alt={story.title}
                  className="h-[420px] w-full object-cover transition duration-700 group-hover:scale-105 md:h-[520px]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6 text-white md:p-7">
                  <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">{story.subtitle}</div>
                  <h3 className="max-w-xs text-[26px] font-[900] leading-[1.04] tracking-tight md:text-[32px]">
                    {story.title}
                  </h3>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1280px] px-4 py-14 md:px-6 md:py-24">
          <h2 className="max-w-2xl text-[32px] font-[900] leading-tight tracking-tight text-[#171717] md:text-[52px]">
            어디서도 만나볼 수 없는
            <br />
            독특한 체험을 호스팅하세요
          </h2>
          <div className="mt-10 grid gap-x-10 gap-y-8 md:mt-14 md:grid-cols-2 lg:grid-cols-3">
            {experienceCategories.map((item) => {
              const Icon = item.icon;

              return (
                <article key={item.title} className="max-w-sm">
                  <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-stone-200 bg-white shadow-sm">
                    <Icon size={24} strokeWidth={1.9} />
                  </div>
                  <h3 className="text-[23px] font-[800] leading-tight tracking-tight text-[#222222]">{item.title}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-[#6c6c6c]">{item.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="border-y border-black/5 bg-white">
          <div className="mx-auto max-w-[1280px] px-4 py-14 md:px-6 md:py-20">
            <h2 className="max-w-3xl text-[32px] font-[900] leading-tight tracking-tight text-[#171717] md:text-[52px]">
              작지만 빠르게 성장하는
              <br />
              로컬 중심 호스트 커뮤니티
            </h2>
            <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-[#6b6b6b] md:text-[20px]">
              로컬리는 아직 거대한 플랫폼보다 더 큐레이션에 가까운 서비스입니다. 그래서 초반 호스트의 색이 더 강하게 페이지에 반영됩니다.
            </p>
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {stats.map((stat) => (
                <div key={stat.label} className="border-t border-[#222222] pt-5">
                  <div className="text-[52px] font-[900] leading-none tracking-tight text-[#171717] md:text-[76px]">{stat.value}</div>
                  <div className="mt-3 text-[18px] font-bold text-[#222222]">{stat.label}</div>
                  <p className="mt-2 text-[14px] leading-relaxed text-[#777777]">{stat.note}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-[1280px] gap-10 px-4 py-14 md:px-6 md:py-24 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">
              <CheckCircle2 size={14} className="text-emerald-500" />
              Listing Preview
            </div>
            <h2 className="text-[32px] font-[900] leading-tight tracking-tight text-[#171717] md:text-[50px]">
              돋보이는 페이지로
              <br />
              바로 예약을 받으세요
            </h2>
            <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-[#6b6b6b] md:text-[20px]">
              사진, 소개, 운영 방식, 호스트의 분위기가 한눈에 읽히는 리스팅으로 게스트가 빠르게 이해하고 예약할 수 있도록 돕습니다.
            </p>
          </div>

          <div className="rounded-[34px] border border-stone-200 bg-white p-4 shadow-[0_24px_80px_rgba(15,23,42,0.08)] md:p-5">
            <div className="overflow-hidden rounded-[28px]">
              <img
                src="https://images.unsplash.com/photo-1527631746610-bca00a040d60?q=80&w=1400&auto=format&fit=crop"
                alt="호스트 리스팅 대표 이미지"
                className="h-[340px] w-full object-cover md:h-[420px]"
              />
            </div>
            <div className="mt-5 flex items-start justify-between gap-4">
              <div>
                <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-stone-400">Host Listing</div>
                <h3 className="mt-2 text-[28px] font-[900] leading-tight tracking-tight text-[#171717]">
                  텐마의 밤,
                  <br />
                  이자카야 세 곳
                </h3>
              </div>
              <div className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1.5 text-[13px] font-bold text-[#222222]">
                <Star size={14} className="fill-[#222222] text-[#222222]" />
                4.9
              </div>
            </div>
            <p className="mt-4 text-[15px] leading-relaxed text-[#6f6f6f]">
              예약 전 메시지로 취향을 먼저 묻고, 게스트가 편하게 들어갈 수 있는 바와 메뉴를 동선으로 연결합니다. 로컬 호스트의 감각이 리스팅 자체에서 드러납니다.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {['야간 체험', '소규모', '로컬 식문화', '메시지 상담 가능'].map((tag) => (
                <span key={tag} className="rounded-full bg-stone-100 px-3 py-1 text-[12px] font-semibold text-stone-600">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1280px] px-4 py-8 md:px-6 md:py-10">
          <div className="mb-8 max-w-2xl md:mb-10">
            <h2 className="text-[32px] font-[900] leading-tight tracking-tight text-[#171717] md:text-[50px]">
              게스트가 필요로 하는
              <br />
              순간에 체험을 보여줍니다
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-[#6b6b6b] md:text-[20px]">
              여행 전과 여행 중, 두 타이밍 모두에서 체험이 다른 문맥으로 보이도록 페이지 구조와 추천 흐름을 설계합니다.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {placementCards.map((card) => (
              <article key={card.title} className="overflow-hidden rounded-[30px] border border-stone-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
                <div className="relative">
                  <img src={card.image} alt={card.title} className="h-[250px] w-full object-cover md:h-[300px]" />
                  <div className="absolute left-5 top-5 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-stone-500 backdrop-blur">
                    {card.badge}
                  </div>
                </div>
                <div className="p-6 md:p-7">
                  <h3 className="text-[26px] font-[900] leading-tight tracking-tight text-[#171717]">{card.title}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-[#6c6c6c]">{card.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1280px] px-4 py-14 md:px-6 md:py-24">
          <div className="mb-8 max-w-2xl md:mb-10">
            <h2 className="text-[32px] font-[900] leading-tight tracking-tight text-[#171717] md:text-[50px]">
              최고의 체험을 위한
              <br />
              운영 기능도 함께 제공합니다
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-[#6b6b6b] md:text-[20px]">
              예약, 일정, 메시지, 결제 흐름이 한곳에 모여 있어 호스트는 콘텐츠와 운영 품질에 집중할 수 있습니다.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {hostTools.map((tool) => {
              const Icon = tool.icon;

              return (
                <article key={tool.title} className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.05)]">
                  <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100 text-[#222222]">
                    <Icon size={24} strokeWidth={1.9} />
                  </div>
                  <h3 className="text-[22px] font-[800] leading-tight tracking-tight text-[#171717]">{tool.title}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-[#6d6d6d]">{tool.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mx-auto max-w-[980px] px-4 py-14 md:px-6 md:py-24">
          <h2 className="text-[32px] font-[900] leading-tight tracking-tight text-[#171717] md:text-[50px]">
            자주 묻는 질문
          </h2>
          <div className="mt-8 divide-y divide-stone-200 rounded-[28px] border border-stone-200 bg-white px-5 md:px-8">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;

              return (
                <div key={faq.question}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="flex w-full items-center justify-between gap-6 py-6 text-left md:py-7"
                  >
                    <span className="text-[18px] font-[800] leading-tight tracking-tight text-[#171717] md:text-[28px]">
                      {faq.question}
                    </span>
                    <div className={`rounded-full border border-stone-200 p-2 transition ${isOpen ? 'rotate-180 bg-stone-100' : 'bg-white'}`}>
                      <ChevronDown size={20} />
                    </div>
                  </button>
                  {isOpen && (
                    <div className="pb-6 pr-10 text-[15px] leading-relaxed text-[#6c6c6c] md:pb-7 md:text-[17px]">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-10 rounded-[34px] bg-[#171717] px-6 py-8 text-white md:mt-14 md:px-10 md:py-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/60">Start hosting on Locally</div>
                <h3 className="mt-3 text-[28px] font-[900] leading-tight tracking-tight md:text-[40px]">
                  당신의 평범한 하루가
                  <br />
                  누군가의 여행이 됩니다
                </h3>
              </div>
              <button
                onClick={handleStartClick}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-4 text-[15px] font-bold text-[#171717] transition hover:-translate-y-0.5"
              >
                {hasApplication ? '내 신청 현황 확인' : '호스트 등록하기'}
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
