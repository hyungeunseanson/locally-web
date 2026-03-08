import { ChevronDown } from "lucide-react";
import Image from "next/image";

import SiteHeader from "@/app/components/SiteHeader";
import HostLandingActionBar from "./HostLandingActionBar";

const HOST_LANDING_ASSET_LOCALE = "ko";

const sections = [
    {
        alt: "Become a host design section 1",
        desktop: { src: `/images/become-a-host/desktop/${HOST_LANDING_ASSET_LOCALE}/1.png`, width: 2880, height: 1260 },
        mobile: { src: `/images/become-a-host/mobile/${HOST_LANDING_ASSET_LOCALE}/1.png`, width: 1740, height: 1688 },
    },
    {
        alt: "Become a host design section 2",
        desktop: { src: `/images/become-a-host/desktop/${HOST_LANDING_ASSET_LOCALE}/2.png`, width: 2880, height: 1434 },
        mobile: { src: `/images/become-a-host/mobile/${HOST_LANDING_ASSET_LOCALE}/2.png`, width: 1740, height: 2394 },
    },
    {
        alt: "Become a host design section 3",
        desktop: { src: `/images/become-a-host/desktop/${HOST_LANDING_ASSET_LOCALE}/3.png`, width: 2880, height: 1156 },
        mobile: { src: `/images/become-a-host/mobile/${HOST_LANDING_ASSET_LOCALE}/3.png`, width: 1740, height: 1156 },
    },
    {
        alt: "Become a host design section 4",
        desktop: { src: `/images/become-a-host/desktop/${HOST_LANDING_ASSET_LOCALE}/4.png`, width: 2880, height: 1296 },
        mobile: { src: `/images/become-a-host/mobile/${HOST_LANDING_ASSET_LOCALE}/4.png`, width: 1740, height: 1296 },
    },
    {
        alt: "Become a host design section 5",
        desktop: { src: `/images/become-a-host/desktop/${HOST_LANDING_ASSET_LOCALE}/5.png`, width: 2880, height: 1542 },
        mobile: { src: `/images/become-a-host/mobile/${HOST_LANDING_ASSET_LOCALE}/5.png`, width: 1740, height: 1542 },
    },
    {
        alt: "Become a host design section 6",
        desktop: { src: `/images/become-a-host/desktop/${HOST_LANDING_ASSET_LOCALE}/6.png`, width: 2880, height: 1502 },
        mobile: { src: `/images/become-a-host/mobile/${HOST_LANDING_ASSET_LOCALE}/6.png`, width: 1740, height: 1502 },
    },
    {
        alt: "Become a host design section 7",
        desktop: { src: `/images/become-a-host/desktop/${HOST_LANDING_ASSET_LOCALE}/7.png`, width: 2880, height: 2264 },
        mobile: { src: `/images/become-a-host/mobile/${HOST_LANDING_ASSET_LOCALE}/7.png`, width: 1740, height: 2264 },
    },
] as const;

const faqGroups = [
    {
        title: "자주 하는 질문",
        items: [
            {
                question: "어떤 체험이 로컬리에 잘 맞나요?",
                answer:
                    "로컬리는 자격증 기반의 투어보다, 실제로 그 동네를 즐기고 소개할 수 있는 호스트의 취향과 시선을 더 중요하게 봅니다. 단골 카페와 로컬 맛집을 함께 도는 코스, 동네 산책, 공예·원데이 클래스, 패션·빈티지 숍 투어처럼 '내가 좋아하는 일상'이 드러나는 체험이 잘 맞습니다.",
            },
            {
                question: "외국어를 유창하게 해야 하나요?",
                answer:
                    "필수는 아닙니다. 기본적인 응대가 가능하고, 필요한 경우 번역 앱이나 사전 안내 메시지로 소통할 수 있으면 충분합니다. 언어 실력보다 더 중요한 건 게스트를 편안하게 맞이하고 체험 흐름을 안정적으로 이끄는 태도입니다.",
            },
            {
                question: "전문 가이드 자격이나 영업허가가 필요한가요?",
                answer:
                    "로컬리에서 진행하는 일반적인 취향 기반 체험은 별도의 가이드 자격증이나 영업허가를 전제로 하지 않습니다. 다만 음식 제조, 운송, 전문 레슨처럼 별도 규정이 적용될 수 있는 활동은 실제 운영 방식에 맞게 사전에 확인해야 합니다.",
            },
        ],
    },
    {
        title: "호스팅 기본사항",
        items: [
            {
                question: "호스트가 준비해야 할 기본 정보는 무엇인가요?",
                answer:
                    "체험 소개, 진행 장소, 예상 소요 시간, 포함·불포함 사항, 준비물, 최대 인원, 예약 가능 일정이 기본입니다. 게스트가 '누구와 어떤 시간을 보내게 되는지'를 바로 이해할 수 있도록 한눈에 읽히는 설명이 중요합니다.",
            },
            {
                question: "예약은 어떻게 관리하나요?",
                answer:
                    "호스트 대시보드에서 예약 현황, 문의, 일정 조율, 정산 흐름을 한 번에 확인하는 방식입니다. 게스트별 특이사항이나 요청사항도 한곳에서 정리할 수 있도록 운영 흐름을 단순하게 가져가는 게 로컬리 방향입니다.",
            },
            {
                question: "한 달에 많이 열지 않아도 괜찮나요?",
                answer:
                    "괜찮습니다. 주말 중심, 월 몇 회 운영처럼 호스트 일정에 맞춰 시작해도 됩니다. 처음부터 과하게 열기보다, 실제로 소화 가능한 일정과 인원으로 시작하는 쪽이 후기와 재방문에 더 유리합니다.",
            },
        ],
    },
    {
        title: "지원 절차",
        items: [
            {
                question: "지원 후에는 어떤 순서로 진행되나요?",
                answer:
                    "기본 신청서 제출 후, 체험 콘셉트와 운영 방식이 로컬리 방향과 맞는지 확인합니다. 필요하면 소개 문구, 일정 구성, 사진 자료를 조금 더 다듬어 달라고 요청할 수 있고, 정리되면 등록과 공개 단계로 넘어갑니다.",
            },
            {
                question: "사진이나 상세 설명은 어느 정도까지 준비해야 하나요?",
                answer:
                    "완벽한 브랜드 소개서 수준까지는 필요 없습니다. 다만 게스트가 체험 장면을 상상할 수 있을 정도의 사진과, 진행 흐름이 보이는 설명은 꼭 있어야 합니다. 이 페이지처럼 비주얼 톤이 좋을수록 전환에 유리합니다.",
            },
            {
                question: "이미 운영 중인 체험을 옮겨와도 되나요?",
                answer:
                    "가능합니다. 다만 기존 플랫폼 설명을 그대로 복사하기보다, 로컬리 톤에 맞게 더 개인적이고 매거진처럼 읽히는 방식으로 다시 정리하는 게 좋습니다. 호스트의 결, 공간의 분위기, 게스트가 남길 기억을 중심으로 바꾸는 쪽이 적합합니다.",
            },
        ],
    },
    {
        title: "정산 및 운영",
        items: [
            {
                question: "정산은 언제 확인할 수 있나요?",
                answer:
                    "예약 확정과 체험 완료를 기준으로 정산 흐름이 잡히며, 호스트는 대시보드에서 진행 상태를 확인할 수 있습니다. 운영 초기에는 일정 관리와 취소 정책을 명확히 해두는 것이 정산 안정성에도 중요합니다.",
            },
            {
                question: "수수료는 어떻게 적용되나요?",
                answer:
                    "호스트가 설정한 가격을 기준으로 플랫폼 운영 수수료가 반영됩니다. 세부 정산 정책은 실제 운영 단계에서 안내하지만, 체험 가격을 잡을 때는 이동 시간, 준비 비용, 응대 시간까지 포함해서 보는 것이 좋습니다.",
            },
            {
                question: "취소나 일정 변경 요청은 어떻게 대응하면 좋나요?",
                answer:
                    "로컬리는 체험 소개 단계에서 집합 장소, 준비물, 변경 가능 범위를 최대한 명확하게 적는 것을 권장합니다. 운영 중에는 메시지 응답 속도와 사전 안내 품질이 만족도에 직접 연결되기 때문에, 표준 안내 문구를 미리 준비해두는 편이 효율적입니다.",
            },
        ],
    },
] as const;

const [heroSection, secondSection, ...remainingSections] = sections;

function LandingSectionImage({
    desktop,
    mobile,
    alt,
    priority = false,
}: {
    desktop: { src: string; width: number; height: number };
    mobile: { src: string; width: number; height: number };
    alt: string;
    priority?: boolean;
}) {
    return (
        <>
            <div className="md:hidden">
                <Image
                    src={mobile.src}
                    alt={alt}
                    width={mobile.width}
                    height={mobile.height}
                    className="block h-auto w-full"
                    priority={priority}
                    sizes="100vw"
                    unoptimized
                />
            </div>
            <div className="hidden md:block">
                <Image
                    src={desktop.src}
                    alt={alt}
                    width={desktop.width}
                    height={desktop.height}
                    className="block h-auto w-full"
                    priority={priority}
                    sizes="(max-width: 1440px) 100vw, 1440px"
                    unoptimized
                />
            </div>
        </>
    );
}

function renderSection(section: typeof sections[number], priority = false) {
    return (
        <LandingSectionImage
            key={section.alt}
            desktop={section.desktop}
            mobile={section.mobile}
            alt={section.alt}
            priority={priority}
        />
    );
}

export default function BecomeHostLandingContent() {
    return (
        <div className="min-h-screen bg-white text-[#222222] font-sans">
            <SiteHeader />

            <main>
                <div className="mx-auto w-full max-w-[1440px]">
                    {renderSection(heroSection, true)}

                    <HostLandingActionBar compact />

                    {renderSection(secondSection, true)}

                    {remainingSections.map((section) => renderSection(section))}
                </div>

                <HostLandingActionBar showStatusButton />

                <section className="bg-[#f7f7f7] px-4 py-16 md:px-6 md:py-24">
                    <div className="mx-auto max-w-[1440px]">
                        <div className="mx-auto max-w-[790px]">
                            <h2 className="text-center text-[34px] font-semibold tracking-[-0.05em] text-[#2f2f2f] md:text-[54px]">
                                자주 묻는 질문과 답변
                            </h2>

                            <div className="mt-10 border-t border-black/8 md:mt-14">
                                {faqGroups.map((group, index) => (
                                    <details
                                        key={group.title}
                                        className="group border-b border-black/8"
                                        open={index === 0}
                                    >
                                        <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left md:py-7 [&::-webkit-details-marker]:hidden">
                                            <h3 className="text-[22px] font-medium tracking-[-0.03em] text-[#2f2f2f] md:text-[30px]">
                                                {group.title}
                                            </h3>
                                            <ChevronDown className="h-5 w-5 shrink-0 text-[#4b4b4b] transition-transform duration-200 group-open:rotate-180 md:h-6 md:w-6" />
                                        </summary>

                                        <div className="space-y-8 pb-7 pr-4 text-[#757575] md:space-y-10 md:pb-9 md:pr-0">
                                            {group.items.map((item) => (
                                                <div key={item.question}>
                                                    <h4 className="text-[17px] font-medium leading-snug text-[#4a4a4a] md:text-[21px]">
                                                        {item.question}
                                                    </h4>
                                                    <p className="mt-2.5 text-[14px] leading-7 md:mt-3 md:text-[16px] md:leading-[1.8]">
                                                        {item.answer}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </details>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}
