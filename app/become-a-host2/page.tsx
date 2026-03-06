import type { ReactNode } from 'react';
import Link from 'next/link';

const storyCards = [
  {
    eyebrow: 'Neighborhood Ride',
    title: '한적한 초원 위에서 시작하는 로컬 승마 체험',
    caption: '호스트의 이야기가 있는 아침 코스로 여행의 첫 장면을 만들어보세요.',
    palette: 'from-[#b8c98b] via-[#8bac61] to-[#5d6845]',
    accent: 'bg-[#734d2f]',
    figure: 'bg-[#f3d6b1]',
  },
  {
    eyebrow: 'City Drive',
    title: '도시의 밤과 자동차 문화를 엮어내는 드라이브 투어',
    caption: '속도와 무드, 현지 감각을 함께 보여주는 호스트형 체험입니다.',
    palette: 'from-[#141414] via-[#3b3b3b] to-[#71685e]',
    accent: 'bg-[#5b7bc6]',
    figure: 'bg-[#d4b48f]',
  },
  {
    eyebrow: 'Beach Movement',
    title: '햇살과 바람, 해변의 리듬을 전하는 액티브 체험',
    caption: '몸으로 기억되는 도시의 표정을 게스트와 함께 나눠보세요.',
    palette: 'from-[#d9d6c7] via-[#8ebc98] to-[#4f7f6d]',
    accent: 'bg-[#ef8e42]',
    figure: 'bg-[#f0c08f]',
  },
] as const;

const categoryItems = [
  {
    icon: '🪴',
    title: '내가 사는 동네의 매력',
    description: '골목, 공원, 시장처럼 오래 살아본 사람만 아는 리듬을 소개하세요.',
  },
  {
    icon: '🍜',
    title: '맛있는 음식을 함께 나누는 시간',
    description: '식문화와 취향을 가장 자연스럽게 보여주는 체험을 만들 수 있어요.',
  },
  {
    icon: '🏞️',
    title: '자연 속 액티비티',
    description: '바다, 숲길, 언덕, 자전거 코스처럼 도시 바깥의 풍경도 매력이 됩니다.',
  },
  {
    icon: '🎨',
    title: '예술과 원데이 클래스',
    description: '공방, 전시, 드로잉, 핸드메이드처럼 감각이 드러나는 구성이 잘 어울립니다.',
  },
  {
    icon: '🧴',
    title: '라이프스타일 큐레이션',
    description: '취향 쇼핑, 뷰티, 빈티지, 공간 탐방처럼 나다운 시선을 상품으로 바꿔보세요.',
  },
] as const;

const placementCards = [
  {
    title: '게스트가 여행을 준비할 때 먼저 보이는 체험',
    description: '도시를 탐색하는 흐름 속에서 로컬리 체험이 자연스럽게 노출되도록 설계합니다.',
    variant: 'feed',
  },
  {
    title: '현지에 도착한 뒤에도 다시 추천되는 체험',
    description: '예약 직전의 순간에도 호스트의 강점이 돋보이도록 여러 접점을 제공합니다.',
    variant: 'listing',
  },
] as const;

const featureCards = [
  {
    title: '게스트 그룹 관리',
    description: '예약 인원과 참여자 상태를 한눈에 정리해 운영 효율을 높입니다.',
    variant: 'guests',
  },
  {
    title: '간단한 일정 운영',
    description: '달력과 메시지를 함께 보며 일정 조율과 변경 요청을 빠르게 처리할 수 있어요.',
    variant: 'calendar',
  },
  {
    title: '호스트용 체험 페이지',
    description: '가격, 소개, 준비물, 일정 정보를 쉽게 정리하고 실시간으로 업데이트합니다.',
    variant: 'editor',
  },
  {
    title: '안전한 정산과 문의 관리',
    description: '예약 이후의 결제 흐름과 게스트 문의 내역까지 한 화면에서 확인할 수 있습니다.',
    variant: 'payout',
  },
] as const;

const faqs = [
  {
    question: '호스트가 되려면',
    answer: [
      '로컬리의 호스트는 전문 가이드 자격보다 “내가 잘 알고 사랑하는 지역을 게스트에게 어떻게 소개할 수 있는지”를 더 중요하게 봅니다. 동네 산책, 식문화 탐방, 빈티지 쇼핑, 원데이 클래스처럼 본인의 일상과 취향이 드러나는 체험일수록 강점이 분명합니다.',
      '신청 시에는 체험의 콘셉트, 진행 방식, 준비물, 예상 시간, 게스트가 얻게 될 경험을 구체적으로 적어주시면 됩니다. 운영 가능 일정과 언어, 수용 인원도 함께 정리하면 승인 이후 실제 공개까지 훨씬 빠르게 연결됩니다.',
      '로컬리는 예약, 정산, 문의, 후기를 한곳에서 관리할 수 있도록 페이지를 구성해두었기 때문에 처음 호스팅을 시작하는 분도 비교적 단순한 흐름으로 체험을 열 수 있습니다.',
    ],
  },
  {
    question: '호스트 기준',
    answer: [
      '현지에 대한 이해, 게스트 응대 태도, 체험 구성의 명확성, 안전성 등을 종합적으로 확인합니다.',
    ],
  },
  {
    question: '관광 분야',
    answer: [
      '산책, 미식, 자연, 공예, 취향 쇼핑, 사진, 야간 투어 등 로컬 맥락이 분명한 분야를 폭넓게 운영할 수 있습니다.',
    ],
  },
  {
    question: '맞춤형 투어',
    answer: [
      '공개형 체험 외에도 일정, 테마, 인원에 맞춘 맞춤형 제안으로 확장할 수 있습니다.',
    ],
  },
] as const;

function LogoMark() {
  return (
    <span className="relative block h-5 w-4">
      <span className="absolute left-0 top-[1px] h-3.5 w-2.5 rotate-[-28deg] rounded-full border-[1.8px] border-[#ff2f74] border-b-transparent border-l-transparent" />
      <span className="absolute right-0 top-[5px] h-3.5 w-2.5 rotate-[-28deg] rounded-full border-[1.8px] border-[#ff2f74] border-r-transparent border-t-transparent" />
    </span>
  );
}

function StatusDots() {
  return (
    <div className="absolute right-4 top-[15px] flex items-center gap-[3px]">
      <span className="h-[5px] w-[5px] rounded-full bg-black/80" />
      <span className="h-[5px] w-[5px] rounded-full bg-black/80" />
      <span className="h-[5px] w-[11px] rounded-full border border-black/70" />
    </div>
  );
}

function PhoneFrame({
  children,
  className = '',
  screenClassName = '',
}: {
  children: ReactNode;
  className?: string;
  screenClassName?: string;
}) {
  return (
    <div
      className={`rounded-[40px] bg-[#141414] p-[4px] shadow-[0_28px_60px_rgba(0,0,0,0.18)] ${className}`}
    >
      <div
        className={`relative overflow-hidden rounded-[36px] bg-[#fbfbfa] ${screenClassName}`}
      >
        <div className="absolute left-4 top-[15px] text-[8px] font-semibold tracking-[0.02em] text-black">
          9:41
        </div>
        <div className="absolute left-1/2 top-[8px] h-[24px] w-[116px] -translate-x-1/2 rounded-full bg-black" />
        <StatusDots />
        <div className="h-full pt-[38px]">{children}</div>
      </div>
    </div>
  );
}

function StoryPhoto({
  palette,
  accent,
  figure,
}: {
  palette: string;
  accent: string;
  figure: string;
}) {
  return (
    <div className={`relative aspect-[0.79] overflow-hidden rounded-[16px] bg-gradient-to-br ${palette}`}>
      <div className="absolute left-0 top-0 h-full w-full bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.38),transparent_42%)]" />
      <div className="absolute bottom-0 left-[-8px] h-[44%] w-[118%] rounded-t-[40%] bg-[#7d6a4f]/35" />
      <div className={`absolute right-6 top-5 h-7 w-7 rounded-full ${accent} opacity-90`} />
      <div className="absolute left-8 bottom-7 h-20 w-24 rounded-[48px] bg-[#2a2a2a]/30 blur-[2px]" />
      <div className={`absolute left-[46%] top-[28%] h-10 w-10 rounded-full ${figure} shadow-sm`} />
      <div className="absolute left-[42%] top-[38%] h-[68px] w-[58px] rounded-[28px] bg-[#274a33]/90" />
      <div className="absolute left-[29%] top-[47%] h-[52px] w-[70px] rounded-[30px] bg-[#6a4426]/90" />
      <div className="absolute left-[25%] top-[56%] h-[10px] w-[34px] rounded-full bg-[#2b2b2b]/80" />
      <div className="absolute left-[58%] top-[56%] h-[10px] w-[34px] rounded-full bg-[#2b2b2b]/80" />
    </div>
  );
}

function HeroPhone() {
  return (
    <PhoneFrame className="w-[318px]" screenClassName="h-[548px]">
      <div className="px-4">
        <div className="mx-auto flex h-[32px] items-center justify-center rounded-full bg-white text-[10px] font-medium text-[#5e5e5e] shadow-[0_2px_10px_rgba(0,0,0,0.08)]">
          오늘, 서울에서 여는 체험
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2 text-center text-[9px] text-[#666666]">
          {['🍳', '🎈', '🚙', '🧁'].map((item, index) => (
            <div key={item} className="rounded-[14px] bg-[#f4f4f2] px-1 py-2">
              <div className="text-[15px]">{item}</div>
              <div className="mt-1 font-medium">{['식도락', '야외', '드라이브', '클래스'][index]}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-t-[28px] bg-white px-4 pb-4 pt-4 shadow-[0_-10px_28px_rgba(0,0,0,0.06)]">
        <p className="text-[11px] font-semibold text-[#1f1f1f]">내가 잘 아는 동네에서 로컬 투어 열기</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {[
            {
              tone: 'from-[#ddd8c7] via-[#af9377] to-[#574739]',
              title: '서촌 산책과 오래된 골목',
            },
            {
              tone: 'from-[#f0d1b8] via-[#b65d44] to-[#6e2f22]',
              title: '토요일 저녁의 미식 코스',
            },
          ].map((card) => (
            <div key={card.title} className="overflow-hidden rounded-[16px] border border-[#ededeb] bg-white shadow-[0_6px_16px_rgba(0,0,0,0.06)]">
              <div className={`h-[114px] bg-gradient-to-br ${card.tone}`}>
                <div className="h-full w-full bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.42),transparent_38%)]" />
              </div>
              <div className="px-2.5 py-2.5">
                <div className="text-[9px] uppercase tracking-[0.18em] text-[#8a8a88]">Locally</div>
                <div className="mt-1 text-[10px] font-semibold leading-[1.35] text-[#202020]">{card.title}</div>
                <div className="mt-1 text-[9px] text-[#797977]">호스트 등록 전 미리보기</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PhoneFrame>
  );
}

function ListingPhone() {
  return (
    <PhoneFrame className="mx-auto w-[230px]" screenClassName="h-[438px]">
      <div className="px-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="h-[104px] rounded-[14px] bg-gradient-to-br from-[#e9d4bc] to-[#b25f37]" />
          <div className="h-[104px] rounded-[14px] bg-gradient-to-br from-[#6cb7c7] to-[#26566a]" />
          <div className="h-[104px] rounded-[14px] bg-gradient-to-br from-[#d4b78f] to-[#87613b]" />
          <div className="h-[104px] rounded-[14px] bg-gradient-to-br from-[#cfc6b8] to-[#8c7c67]" />
        </div>
        <div className="mt-3 rounded-[18px] bg-white px-4 py-4 shadow-[0_12px_24px_rgba(0,0,0,0.08)]">
          <div className="text-[9px] uppercase tracking-[0.16em] text-[#8a8a88]">Locally Listing</div>
          <div className="mt-2 text-[13px] font-semibold leading-[1.35] text-[#202020]">
            로컬 감도가 살아 있는
            <br />
            호스트 체험 페이지
          </div>
          <div className="mt-2 h-[6px] w-[70%] rounded-full bg-[#ededeb]" />
          <div className="mt-1.5 h-[6px] w-[46%] rounded-full bg-[#ededeb]" />
        </div>
      </div>
    </PhoneFrame>
  );
}

function FeedPlacementPhone() {
  return (
    <PhoneFrame className="mx-auto w-[188px]" screenClassName="h-[372px]">
      <div className="px-3">
        <div className="rounded-[14px] bg-white px-3 py-2 shadow-[0_6px_16px_rgba(0,0,0,0.06)]">
          <div className="text-[9px] font-semibold text-[#232323]">이번 주 인기 체험</div>
          <div className="mt-2 h-[62px] rounded-[12px] bg-gradient-to-br from-[#ddd8c7] to-[#967b59]" />
          <div className="mt-2 h-[5px] w-[72%] rounded-full bg-[#ecebe8]" />
          <div className="mt-1 h-[5px] w-[55%] rounded-full bg-[#ecebe8]" />
        </div>
        <div className="mt-3 rounded-[14px] bg-[#f5f5f3] px-3 py-3">
          <div className="mb-2 text-[8px] uppercase tracking-[0.16em] text-[#8a8a88]">추천 위치</div>
          <div className="space-y-2">
            {[0, 1, 2].map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-[11px] bg-white px-2 py-2">
                <div className="h-7 w-7 rounded-[8px] bg-gradient-to-br from-[#f3d8be] to-[#b97144]" />
                <div className="flex-1">
                  <div className="h-[4px] w-[84%] rounded-full bg-[#eae9e6]" />
                  <div className="mt-1 h-[4px] w-[58%] rounded-full bg-[#eae9e6]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}

function ListingPlacementPhone() {
  return (
    <PhoneFrame className="mx-auto w-[188px]" screenClassName="h-[372px]">
      <div className="px-3">
        <div className="rounded-[16px] bg-white px-3 py-3 shadow-[0_6px_16px_rgba(0,0,0,0.06)]">
          <div className="h-[118px] rounded-[14px] bg-gradient-to-br from-[#f2d7e1] to-[#b56278]" />
          <div className="mt-3 text-[10px] font-semibold leading-[1.35] text-[#1d1d1d]">도착 후 바로 참여할 수 있는 오늘의 체험</div>
          <div className="mt-2 flex items-center gap-1 text-[8px] text-[#8a8a88]">
            <span>서울</span>
            <span>·</span>
            <span>2시간</span>
            <span>·</span>
            <span>₩48,000</span>
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}

function FeaturePhone({ variant }: { variant: (typeof featureCards)[number]['variant'] }) {
  if (variant === 'guests') {
    return (
      <PhoneFrame className="mx-auto w-[186px]" screenClassName="h-[372px]">
        <div className="px-3">
          <div className="rounded-[16px] bg-white px-4 py-4 shadow-[0_8px_18px_rgba(0,0,0,0.06)]">
            <div className="text-[10px] font-semibold text-[#222222]">함께 오는 게스트</div>
            <div className="mt-5 flex justify-center -space-x-2">
              {['bg-[#d8bf9a]', 'bg-[#c89d6c]', 'bg-[#f2c7b8]', 'bg-[#8c6d48]', 'bg-[#b6a08f]'].map((tone, index) => (
                <div
                  key={tone}
                  className={`flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold text-white ${tone}`}
                >
                  {['M', 'J', 'S', 'D', 'A'][index]}
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-[14px] bg-[#f4f4f2] px-3 py-3 text-center">
              <div className="text-[8px] uppercase tracking-[0.14em] text-[#8a8a88]">This week</div>
              <div className="mt-1 text-[19px] font-semibold text-[#222222]">37명</div>
              <div className="mt-1 text-[8px] text-[#8a8a88]">확정된 참여 게스트</div>
            </div>
          </div>
        </div>
      </PhoneFrame>
    );
  }

  if (variant === 'calendar') {
    return (
      <PhoneFrame className="mx-auto w-[186px]" screenClassName="h-[372px]">
        <div className="px-3">
          <div className="rounded-[16px] bg-white px-3 py-3 shadow-[0_8px_18px_rgba(0,0,0,0.06)]">
            <div className="grid grid-cols-7 gap-1 text-center text-[8px] text-[#8a8a88]">
              {['월', '화', '수', '목', '금', '토', '일'].map((day) => (
                <span key={day}>{day}</span>
              ))}
              {Array.from({ length: 28 }).map((_, index) => (
                <span
                  key={index}
                  className={`flex h-5 items-center justify-center rounded-full ${index === 10 ? 'bg-black text-white' : 'text-[#414141]'}`}
                >
                  {index + 1}
                </span>
              ))}
            </div>
            <div className="mt-4 rounded-[14px] bg-[#111111] px-3 py-3 text-white">
              <div className="text-[9px] font-semibold">게스트 메시지</div>
              <div className="mt-2 rounded-[11px] bg-white/10 px-2 py-2 text-[8px] leading-[1.45] text-white/85">
                안녕하세요. 비 오는 날에도 진행 가능한가요?
              </div>
            </div>
          </div>
        </div>
      </PhoneFrame>
    );
  }

  if (variant === 'editor') {
    return (
      <PhoneFrame className="mx-auto w-[186px]" screenClassName="h-[372px]">
        <div className="px-3">
          <div className="rounded-[16px] bg-white px-3 py-3 shadow-[0_8px_18px_rgba(0,0,0,0.06)]">
            <div className="rounded-[14px] bg-gradient-to-br from-[#dbc7b0] to-[#7c5a3b] p-3 text-white">
              <div className="text-[8px] uppercase tracking-[0.16em] text-white/80">Host Page</div>
              <div className="mt-2 text-[12px] font-semibold leading-[1.35]">
                성수의 빈티지 숍과
                <br />
                카페를 걷는 오후
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {['w-[76%]', 'w-[58%]', 'w-[64%]'].map((width, index) => (
                <div key={`${width}-${index}`} className={`h-[7px] rounded-full bg-[#ededeb] ${width}`} />
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between rounded-[12px] bg-[#f4f4f2] px-3 py-2">
              <span className="text-[8px] font-semibold text-[#414141]">가격 설정</span>
              <span className="text-[10px] font-semibold text-[#1f1f1f]">₩48,000</span>
            </div>
          </div>
        </div>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame className="mx-auto w-[186px]" screenClassName="h-[372px] bg-[#202020]">
      <div className="px-3 text-white">
        <div className="rounded-[16px] bg-white/8 px-3 py-3">
          <div className="text-[9px] font-semibold text-white">이번 달 정산 예정</div>
          <div className="mt-2 text-[24px] font-semibold">₩1,480,000</div>
          <div className="mt-1 text-[8px] text-white/70">체험 종료 후 다음 달에 정산됩니다.</div>
        </div>
        <div className="mt-4 rounded-[16px] bg-white px-3 py-3 text-[#1f1f1f] shadow-[0_8px_18px_rgba(0,0,0,0.12)]">
          <div className="text-[8px] uppercase tracking-[0.14em] text-[#8a8a88]">게스트 문의</div>
          <div className="mt-2 rounded-[11px] bg-[#f4f4f2] px-2 py-2 text-[8px] leading-[1.45] text-[#444444]">
            내일 모이는 장소를 조금 더 자세히 알려주실 수 있을까요?
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}

function SectionHeading({
  title,
  description,
  className = '',
}: {
  title: ReactNode;
  description: string;
  className?: string;
}) {
  return (
    <div className={`text-center ${className}`}>
      <h2 className="text-[22px] font-semibold leading-[1.18] tracking-[-0.03em] text-[#171717] md:text-[26px]">
        {title}
      </h2>
      <p className="mx-auto mt-3 max-w-[420px] text-[11px] leading-[1.65] text-[#767676] md:text-[12px]">
        {description}
      </p>
    </div>
  );
}

export default function BecomeHost2Page() {
  return (
    <div className="min-h-screen bg-[#efefef] text-[#1d1d1d]">
      <main className="overflow-x-hidden">
        <div className="mx-auto max-w-[1705px]">
          <header className="mx-auto flex max-w-[1280px] items-center justify-between px-14 pb-10 pt-7">
            <Link href="/" className="inline-flex items-center">
              <LogoMark />
            </Link>
            <button
              type="button"
              className="rounded-full bg-[#ff2f74] px-4 py-[5px] text-[10px] font-semibold text-white shadow-[0_8px_18px_rgba(255,47,116,0.18)] transition hover:brightness-95"
            >
              시작하기
            </button>
          </header>

          <section className="mx-auto grid max-w-[1150px] grid-cols-[300px_1fr] items-center gap-x-[120px] px-10 pb-[122px]">
            <div className="justify-self-end">
              <h1 className="text-[30px] font-semibold leading-[1.08] tracking-[-0.05em] text-[#171717]">
                좋아하는 일을 하며
                <br />
                수입을 올리세요
              </h1>
              <p className="mt-4 max-w-[220px] text-[11px] leading-[1.6] text-[#7a7a7a]">
                스스로 사랑하는 도시와 취향을
                <br />
                여행자에게 보여줄 준비가 되셨나요.
              </p>
            </div>
            <div className="justify-self-start">
              <HeroPhone />
            </div>
          </section>

          <section className="mx-auto max-w-[760px] px-8 pb-[108px]">
            <SectionHeading
              title={
                <>
                  로컬리에서
                  <br />
                  우리 지역의 매력을
                  <br />
                  생생하게 소개하세요
                </>
              }
              description="게스트에게는 새로운 로컬의 얼굴을 보여주고, 호스트에게는 오래 이어질 수익 흐름을 만들어보세요."
            />

            <div className="mt-12 grid grid-cols-3 gap-4">
              {storyCards.map((card) => (
                <article
                  key={card.title}
                  className="overflow-hidden rounded-[18px] border border-white/70 bg-white p-[6px] shadow-[0_10px_24px_rgba(0,0,0,0.06)]"
                >
                  <StoryPhoto palette={card.palette} accent={card.accent} figure={card.figure} />
                  <div className="px-2.5 pb-2 pt-3">
                    <p className="text-[8px] uppercase tracking-[0.18em] text-[#8c8c89]">{card.eyebrow}</p>
                    <h3 className="mt-1.5 text-[11px] font-semibold leading-[1.45] text-[#1e1e1e]">{card.title}</h3>
                    <p className="mt-1.5 text-[9px] leading-[1.5] text-[#7d7d7a]">{card.caption}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="mx-auto max-w-[760px] px-8 pb-[112px]">
            <SectionHeading
              title={
                <>
                  어디서도 만나볼 수 없는
                  <br />
                  독특한 체험을 호스팅하세요
                </>
              }
              description="호스트의 일상과 시선이 분명하게 드러나는 순간일수록 여행자는 더 오래 기억합니다."
            />

            <div className="mx-auto mt-10 grid max-w-[620px] grid-cols-2 gap-x-10 gap-y-7">
              {categoryItems.map((item, index) => (
                <article
                  key={item.title}
                  className={`${index === categoryItems.length - 1 ? 'col-span-2 mx-auto max-w-[290px]' : ''} flex items-start gap-3`}
                >
                  <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-[16px] bg-white text-[22px] shadow-[0_8px_18px_rgba(0,0,0,0.06)]">
                    {item.icon}
                  </div>
                  <div className="pt-1">
                    <h3 className="text-[11px] font-semibold leading-[1.45] text-[#1f1f1f]">{item.title}</h3>
                    <p className="mt-1.5 text-[10px] leading-[1.55] text-[#7b7b78]">{item.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="mx-auto max-w-[760px] px-8 pb-[108px]">
            <SectionHeading
              title={
                <>
                  수백만 명의 게스트.
                  <br />
                  여행 업계에서
                  <br />
                  가장 사랑받는 브랜드.
                </>
              }
              description="게스트에게 신뢰받는 디자인과 명확한 흐름은, 처음 보는 체험도 예약하게 만드는 중요한 이유가 됩니다."
            />

            <div className="mt-9 flex justify-center -space-x-3">
              {[
                { label: 'M', tone: 'bg-[#a66b4a]' },
                { label: 'J', tone: 'bg-[#c7a26d]' },
                { label: 'S', tone: 'bg-[#d9b09d]' },
                { label: 'A', tone: 'bg-[#8a6645]' },
                { label: 'L', tone: 'bg-[#8e6f52]' },
              ].map((avatar) => (
                <div
                  key={avatar.label}
                  className={`flex h-[58px] w-[58px] items-center justify-center rounded-full border-[3px] border-[#efefef] text-[16px] font-semibold text-white shadow-[0_8px_18px_rgba(0,0,0,0.08)] ${avatar.tone}`}
                >
                  {avatar.label}
                </div>
              ))}
            </div>

            <div className="mx-auto mt-8 max-w-[270px] text-center">
              <div className="border-t border-black/10 pt-5">
                <div className="text-[9px] uppercase tracking-[0.18em] text-[#8a8a88]">브랜드 선호도</div>
                <div className="mt-2 text-[31px] font-semibold tracking-[-0.04em] text-[#1d1d1d]">39억 원</div>
                <p className="mt-2 text-[10px] leading-[1.5] text-[#7b7b78]">게스트가 신뢰하는 프리미엄 체험 브랜딩 가치</p>
              </div>
              <div className="mt-5 border-t border-black/10 pt-5">
                <div className="text-[9px] uppercase tracking-[0.18em] text-[#8a8a88]">글로벌 여행 시장</div>
                <div className="mt-2 text-[31px] font-semibold tracking-[-0.04em] text-[#1d1d1d]">810억 달러</div>
                <p className="mt-2 text-[10px] leading-[1.5] text-[#7b7b78]">여행자가 경험 중심 예약에 쓰는 빠르게 성장하는 수요</p>
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-[760px] px-8 pb-[118px]">
            <SectionHeading
              title={
                <>
                  돋보이는 리스팅으로
                  <br />
                  바로 예약을 받으세요
                </>
              }
              description="사진과 소개 문구, 운영 정보가 정리된 체험 페이지는 게스트가 망설이지 않도록 도와줍니다."
            />
            <div className="mt-9">
              <ListingPhone />
            </div>
          </section>

          <section className="mx-auto max-w-[760px] px-8 pb-[112px]">
            <SectionHeading
              title={
                <>
                  게스트의 관심을 끌도록
                  <br />
                  적재적소에 체험 표시
                </>
              }
              description="여행을 계획하는 순간과 현지에 도착한 순간, 모두 다른 맥락으로 체험을 다시 보여줄 수 있습니다."
            />

            <div className="mt-10 grid grid-cols-2 gap-8">
              {placementCards.map((card) => (
                <article key={card.title} className="text-center">
                  <div className="rounded-[12px] bg-[#f4f3f1] px-5 py-6">
                    {card.variant === 'feed' ? <FeedPlacementPhone /> : <ListingPlacementPhone />}
                  </div>
                  <h3 className="mx-auto mt-4 max-w-[230px] text-[11px] font-semibold leading-[1.45] text-[#1f1f1f]">{card.title}</h3>
                  <p className="mx-auto mt-2 max-w-[230px] text-[10px] leading-[1.55] text-[#7b7b78]">{card.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="mx-auto max-w-[760px] px-8 pb-[124px]">
            <SectionHeading
              title={
                <>
                  최고의 체험을 위한 최고의 기능
                </>
              }
              description="운영 관리, 일정 조율, 게스트 소통, 정산까지 한 화면 안에서 필요한 흐름을 이어갑니다."
            />

            <div className="mt-10 grid grid-cols-2 gap-x-8 gap-y-10">
              {featureCards.map((card) => (
                <article key={card.title} className="text-center">
                  <div className="rounded-[12px] bg-[#f4f3f1] px-5 py-6">
                    <FeaturePhone variant={card.variant} />
                  </div>
                  <h3 className="mx-auto mt-4 max-w-[230px] text-[11px] font-semibold leading-[1.45] text-[#1f1f1f]">{card.title}</h3>
                  <p className="mx-auto mt-2 max-w-[230px] text-[10px] leading-[1.55] text-[#7b7b78]">{card.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="bg-[#e7e6e4] py-[96px]">
            <div className="mx-auto max-w-[660px] px-8">
              <h2 className="text-center text-[26px] font-semibold tracking-[-0.04em] text-[#171717]">
                자주 묻는 질문과 답변
              </h2>
              <div className="mt-10 space-y-0 border-t border-black/10">
                {faqs.map((item, index) => (
                  <details
                    key={item.question}
                    open={index === 0}
                    className="group border-b border-black/10"
                  >
                    <summary className="list-none cursor-pointer px-0 py-5 [&::-webkit-details-marker]:hidden">
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="text-[13px] font-semibold text-[#202020]">{item.question}</h3>
                        <span className="text-[16px] text-[#6b6b68] group-open:hidden">+</span>
                        <span className="hidden text-[16px] text-[#6b6b68] group-open:block">−</span>
                      </div>
                    </summary>
                    <div className="pb-6 text-[11px] leading-[1.75] text-[#6f6f6b]">
                      {item.answer.map((paragraph) => (
                        <p key={paragraph} className="mb-3 last:mb-0">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </section>

          <footer className="border-t border-black/5 bg-[#efefef] px-10 py-5 text-[9px] text-[#9a9a96]">
            <div className="mx-auto flex max-w-[1620px] items-center justify-between gap-6">
              <p className="tracking-[0.01em]">
                © 2026 Locally, Inc. · 개인정보 처리방침 · 이용약관 · 사이트맵 · 회사 정보
              </p>
              <div className="flex items-center gap-3 text-[10px]">
                <span>◦</span>
                <span>◎</span>
                <span>○</span>
                <span>△</span>
                <span>□</span>
              </div>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
