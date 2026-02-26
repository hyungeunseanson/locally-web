'use client';

import React, { useState, useEffect } from 'react';
import { Search, X, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/app/context/LanguageContext';
import DatePicker from '@/app/components/DatePicker';

interface MobileSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    activeTab: 'experience' | 'service';
    setActiveTab: (tab: 'experience' | 'service') => void;
    locationInput: string;
    setLocationInput: (val: string) => void;
    dateRange: { start: Date | null; end: Date | null };
    setDateRange: (range: any) => void;
    selectedLanguage: string;
    setSelectedLanguage: (lang: string) => void;
    onSearch: () => void;
}

export default function MobileSearchModal({
    isOpen, onClose, activeTab, setActiveTab,
    locationInput, setLocationInput,
    dateRange, setDateRange,
    selectedLanguage, setSelectedLanguage,
    onSearch,
}: MobileSearchModalProps) {
    const { t } = useLanguage();
    const router = useRouter();
    const [activePanel, setActivePanel] = useState<'location' | 'date' | 'language' | null>('location');
    const [isVisible, setIsVisible] = useState(false);
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setActivePanel('location');
            setIsSearchExpanded(false);
            if (!selectedLanguage || selectedLanguage === 'all') {
                setSelectedLanguage('한국어');
            }
            requestAnimationFrame(() => setIsVisible(true));
    } else {
        setIsVisible(false);
    }
}, [isOpen, selectedLanguage, setSelectedLanguage]);

    if (!isOpen) return null;

    const languages = [
        { label: '한국어', value: '한국어', sub: 'Korean', code: 'kr' },
        { label: '영어', value: '영어', sub: 'English', code: 'us' },
        { label: '일본어', value: '일본어', sub: 'Japanese', code: 'jp' },
        { label: '중국어', value: '중국어', sub: 'Chinese', code: 'cn' },
    ];

    const recommendedPlaces = [
        { id: 'tokyo', name: '도쿄, 일본', desc: '도쿄 타워가 빛나는 곳' },
        { id: 'osaka', name: '오사카, 일본', desc: '미식과 야경이 살아있는 곳' },
        { id: 'kyoto', name: '교토, 일본', desc: '고즈넉한 골목이 남아있는 곳' },
        { id: 'izakaya', name: '이자카야 체험', desc: '현지 밤문화를 맛보는 곳' },
        { id: 'seoul', name: '서울, 한국', desc: '감성이 스며든 곳' },
    ];

    const recentSearches = [
        { id: 'recent-tokyo', name: '도쿄', desc: '3월 17일~25일 · 게스트 1명' },
    ];

    const PlaceIcon = ({ type }: { type: string }) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            {type === 'tokyo' && (
                <>
                    <path d="M12 3v18" />
                    <path d="M9 9h6" />
                    <path d="M7.5 12h9" />
                    <path d="M6 18h12" />
                    <path d="M10.5 6h3" />
                </>
            )}
            {type === 'osaka' && (
                <>
                    <path d="M5 18h14" />
                    <path d="M6 18v-6h12v6" />
                    <path d="M7 12l5-4 5 4" />
                    <path d="M9 9V6h6v3" />
                </>
            )}
            {type === 'kyoto' && (
                <>
                    <path d="M4 7h16" />
                    <path d="M6 7v10" />
                    <path d="M18 7v10" />
                    <path d="M8 12h8" />
                    <path d="M10 17h4" />
                </>
            )}
            {type === 'izakaya' && (
                <>
                    <path d="M9 4h6" />
                    <path d="M10 4v2" />
                    <path d="M14 4v2" />
                    <rect x="8" y="6" width="8" height="12" rx="3" />
                    <path d="M9.5 10h5" />
                </>
            )}
            {type === 'seoul' && (
                <>
                    <path d="M6 18h12" />
                    <path d="M8 18V7h8v11" />
                    <path d="M10 7V4h4v3" />
                    <path d="M9 12h6" />
                </>
            )}
            {!['tokyo', 'osaka', 'kyoto', 'izakaya', 'seoul'].includes(type) && (
                <circle cx="12" cy="12" r="8" />
            )}
        </svg>
    );

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 250);
    };

    const handleSearch = () => {
        onSearch();
        setIsVisible(false);
        setTimeout(() => {
            onClose();
            if (locationInput) {
                router.push(`/search?location=${encodeURIComponent(locationInput)}&language=${selectedLanguage}`);
            }
        }, 250);
    };

    const handleClearAll = () => {
        setLocationInput('');
        setDateRange({ start: null, end: null });
        setSelectedLanguage('한국어');
    };

    const formatDateRange = () => {
        if (dateRange.start && dateRange.end) {
            return `${dateRange.start.getMonth() + 1}월 ${dateRange.start.getDate()}일 - ${dateRange.end.getMonth() + 1}월 ${dateRange.end.getDate()}일`;
        }
        if (dateRange.start) return `${dateRange.start.getMonth() + 1}월 ${dateRange.start.getDate()}일`;
        return '';
    };

    const getLanguageLabel = () => {
        if (!selectedLanguage) return '';
        return languages.find(l => l.value === selectedLanguage)?.label || '';
    };

    // 접힌 패널
    const CollapsedPanel = ({ label, value, placeholder, panelKey }: { label: string; value: string; placeholder: string; panelKey: 'location' | 'date' | 'language' }) => (
        <button
            onClick={() => setActivePanel(panelKey)}
            className="w-full bg-white flex items-center justify-between px-5 py-[14px] text-left active:scale-[0.99] transition-transform"
            style={{
                borderRadius: '16px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)',
                border: '0.5px solid #E3E3E3',
            }}
        >
            <span className="text-[12px] text-[#717171] font-medium">{label}</span>
            <span className={`text-[12px] ${value ? 'text-[#222222] font-semibold' : 'text-[#B0B0B0] font-medium'}`}>{value || placeholder}</span>
        </button>
    );

    // 🔍 검색 확장 모드 (에어비앤비 여행지 검색 화면)
    if (isSearchExpanded) {
        return (
            <div className="fixed inset-0 z-[200] flex flex-col h-[100dvh] relative">
                <div
                    className="absolute inset-0 -z-10 backdrop-blur-[8px]"
                    style={{ background: 'rgba(255,255,255,0.18)' }}
                />
                {/* 상단 검색바 */}
                <div className="bg-white mx-4 mt-[calc(env(safe-area-inset-top,0px)+12px)] rounded-full flex items-center gap-2.5 px-4 py-[11px]"
                    style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 2px 10px rgba(0,0,0,0.05)', border: '0.5px solid #E0E0E0' }}>
                    <button onClick={() => setIsSearchExpanded(false)} className="shrink-0">
                        <ArrowLeft size={18} className="text-[#222222]" strokeWidth={2} />
                    </button>
                    <input
                        type="text"
                        placeholder="여행지 검색"
                        value={locationInput}
                        onChange={(e) => setLocationInput(e.target.value)}
                        className="flex-1 bg-transparent text-[14px] text-[#222222] outline-none placeholder:text-[#B0B0B0] font-normal"
                        autoFocus
                    />
                </div>

                {/* 검색 결과 리스트 */}
                <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8">
                    {/* 최근 검색 */}
                    <div className="mb-5">
                        <p className="text-[10px] font-semibold text-[#717171] mb-2 px-1 tracking-[0.04em]">최근 검색</p>
                        {recentSearches.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => { setLocationInput(item.name); setIsSearchExpanded(false); setActivePanel('date'); }}
                                className="flex items-center gap-3 w-full py-[10px] px-1 text-left active:bg-[#EDEDED] rounded-xl transition-colors"
                            >
                                <div className="w-[44px] h-[44px] rounded-[12px] flex items-center justify-center shrink-0"
                                    style={{ background: '#F5F7F2', border: '0.5px solid #E0E6DC' }}>
                                    <PlaceIcon type="kyoto" />
                                </div>
                                <div>
                                    <span className="text-[13px] font-semibold text-[#222222] block">{item.name}</span>
                                    <span className="text-[11px] text-[#8B8B8B] font-normal">{item.desc}</span>
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* 추천 여행지 */}
                    <div>
                        <p className="text-[10px] font-semibold text-[#717171] mb-2 px-1 tracking-[0.04em]">추천 여행지</p>
                        {recommendedPlaces
                            .filter(place => !locationInput || place.name.includes(locationInput))
                            .map((place, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => { setLocationInput(place.name.split(',')[0]); setIsSearchExpanded(false); setActivePanel('date'); }}
                                    className="flex items-center gap-3 w-full py-[10px] px-1 text-left active:bg-[#EDEDED] rounded-xl transition-colors"
                                >
                                    <div className="w-[44px] h-[44px] rounded-[12px] flex items-center justify-center shrink-0"
                                        style={{ background: '#F3F4F6', border: '0.5px solid #E5E7EB' }}>
                                        <PlaceIcon type={place.id} />
                                    </div>
                                    <div>
                                        <span className="text-[13px] font-semibold text-[#222222] block">{place.name}</span>
                                        <span className="text-[11px] text-[#7A7A7A] font-normal">{place.desc}</span>
                                    </div>
                                </button>
                            ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[200] flex flex-col h-[100dvh]">
            {/* 배경: 화면이 보이는 반투명 레이어 + 블러 */}
            <div
                className="absolute inset-0 -z-10 backdrop-blur-[10px] transition-opacity duration-300"
                style={{
                    background: 'rgba(255,255,255,0.18)',
                    opacity: isVisible ? 1 : 0,
                }}
            />

            {/* 콘텐츠 슬라이드업 */}
            <div
                className="flex flex-col flex-1 transition-all duration-300 ease-out"
                style={{
                    transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
                    opacity: isVisible ? 1 : 0,
                }}
            >
                {/* 상단: 아이콘 탭 중앙정렬 + X */}
                <div className="flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top,0px)+10px)] pb-2">
                    <div className="flex-1 flex items-center justify-center gap-[36px]">
                        {/* 체험 */}
                        <button onClick={() => setActiveTab('experience')} className="flex flex-col items-center relative active:scale-[0.90] transition-transform duration-200">
                            <div className="w-[36px] h-[36px] flex items-center justify-center relative mb-0">
                                <img
                                    src="https://a0.muscache.com/im/pictures/airbnb-platform-assets/AirbnbPlatformAssets-search-bar-icons/original/e47ab655-027b-4679-b2e6-df1c99a5c33d.png?im_w=240"
                                    alt="체험" className={`w-full h-full object-contain transition-opacity ${activeTab !== 'experience' ? 'opacity-30' : 'opacity-100'}`}
                                />
                            </div>
                            <span className={`text-[9px] tracking-[0.01em] ${activeTab === 'experience' ? 'text-[#222222] font-bold' : 'text-[#717171] font-normal'}`}>
                                {t('cat_exp')}
                            </span>
                            {activeTab === 'experience' && <span className="absolute -bottom-[2px] left-1/2 -translate-x-1/2 w-[14px] h-[2px] bg-[#222222] rounded-full" />}
                        </button>
                        {/* 서비스 */}
                        <button onClick={() => setActiveTab('service')} className="flex flex-col items-center relative active:scale-[0.90] transition-transform duration-200">
                            <div className="w-[36px] h-[36px] flex items-center justify-center relative mb-0">
                                <img
                                    src="https://a0.muscache.com/im/pictures/airbnb-platform-assets/AirbnbPlatformAssets-search-bar-icons/original/3d67e9a9-520a-49ee-b439-7b3a75ea814d.png?im_w=240"
                                    alt="서비스" className={`w-full h-full object-contain transition-opacity ${activeTab !== 'service' ? 'opacity-30' : 'opacity-100'}`}
                                />
                            </div>
                            <span className={`text-[9px] tracking-[0.01em] ${activeTab === 'service' ? 'text-[#222222] font-bold' : 'text-[#717171] font-normal'}`}>
                                {t('cat_service')}
                            </span>
                            {activeTab === 'service' && <span className="absolute -bottom-[2px] left-1/2 -translate-x-1/2 w-[14px] h-[2px] bg-[#222222] rounded-full" />}
                        </button>
                    </div>

                    {/* X 닫기 */}
                    <button
                        onClick={handleClose}
                        className="w-[30px] h-[30px] rounded-full flex items-center justify-center bg-white shrink-0 active:scale-[0.9] transition-transform ml-2"
                        style={{ border: '1px solid #CFCFCF', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                    >
                        <X size={12} className="text-[#222222]" strokeWidth={3} />
                    </button>
                </div>

                {/* 메인 콘텐츠 */}
                <div className="flex-1 overflow-y-auto px-4 pt-2 pb-28">
                    {/* 위치 패널 */}
                    {activePanel === 'location' ? (
                        <div
                            className="bg-white mb-2 overflow-hidden"
                            style={{ borderRadius: '22px', boxShadow: '0 2px 6px rgba(0,0,0,0.05), 0 8px 18px rgba(0,0,0,0.06)', border: '0.5px solid #E6E6E6' }}
                        >
                            <div className="p-5 pb-4">
                                <h3 className="text-[16px] font-extrabold text-[#222222] mb-3 tracking-[-0.02em]">위치</h3>
                                <button
                                    onClick={() => setIsSearchExpanded(true)}
                                    className="flex items-center gap-2.5 bg-white rounded-[10px] px-3.5 py-[11px] w-full text-left"
                                    style={{ border: '1px solid #D7D7D7', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.6)' }}
                                >
                                    <Search size={13} className="text-[#8E8E8E] shrink-0" strokeWidth={2} />
                                    <span className="text-[12px] text-[#9B9B9B] font-normal">{locationInput || '여행지 검색'}</span>
                                </button>

                                <div className="mt-4">
                                    <p className="text-[9px] font-semibold text-[#7A7A7A] mb-2 tracking-[0.04em]">최근 검색</p>
                                    {recentSearches.map((item) => (
                                        <button
                                            key={item.id}
                                            onClick={() => { setLocationInput(item.name); setActivePanel('date'); }}
                                            className="flex items-center gap-2.5 w-full py-[8px] text-left active:bg-[#F3F3F3] rounded-lg transition-colors"
                                        >
                                            <div
                                                className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center shrink-0"
                                                style={{ background: '#F5F7F2', border: '0.5px solid #E1E7DB' }}
                                            >
                                                <PlaceIcon type="kyoto" />
                                            </div>
                                            <div>
                                                <span className="text-[12px] font-semibold text-[#222222] block">{item.name}</span>
                                                <span className="text-[10px] text-[#8B8B8B] font-normal">{item.desc}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                <div className="mt-4">
                                    <p className="text-[9px] font-semibold text-[#7A7A7A] mb-2 tracking-[0.04em]">추천 여행지</p>
                                    {recommendedPlaces.map((place) => (
                                        <button
                                            key={place.id}
                                            onClick={() => { setLocationInput(place.name.split(',')[0]); setActivePanel('date'); }}
                                            className="flex items-center gap-2.5 w-full py-[8px] text-left active:bg-[#F3F3F3] rounded-lg transition-colors"
                                        >
                                            <div
                                                className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center shrink-0"
                                                style={{ background: '#F3F4F6', border: '0.5px solid #E5E7EB' }}
                                            >
                                                <PlaceIcon type={place.id} />
                                            </div>
                                            <div>
                                                <span className="text-[12px] font-semibold text-[#222222] block">{place.name}</span>
                                                <span className="text-[10px] text-[#7A7A7A] font-normal">{place.desc}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="mb-2">
                    <CollapsedPanel label="위치" value={locationInput} placeholder="여행지 추가" panelKey="location" />
                        </div>
                    )}

                    {/* 날짜 패널 */}
                    {activePanel === 'date' ? (
                        <div
                            className="bg-white mb-2 overflow-hidden"
                            style={{ borderRadius: '22px', boxShadow: '0 2px 6px rgba(0,0,0,0.05), 0 8px 18px rgba(0,0,0,0.06)', border: '0.5px solid #E6E6E6' }}
                        >
                            <div className="p-5">
                                <h3 className="text-[16px] font-extrabold text-[#222222] mb-3 tracking-[-0.02em]">날짜</h3>
                                <DatePicker
                                    selectedRange={dateRange}
                                    onChange={(range) => {
                                        setDateRange(range);
                                        if (range.start && range.end) setActivePanel('language');
                                    }}
                                    variant="mobile"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="mb-2">
                    <CollapsedPanel label="날짜" value={formatDateRange()} placeholder="날짜 추가" panelKey="date" />
                        </div>
                    )}

                    {/* 언어 패널 */}
                    {activePanel === 'language' ? (
                        <div
                            className="bg-white mb-2 overflow-hidden"
                            style={{ borderRadius: '22px', boxShadow: '0 2px 6px rgba(0,0,0,0.05), 0 8px 18px rgba(0,0,0,0.06)', border: '0.5px solid #E6E6E6' }}
                        >
                            <div className="p-5">
                                <h3 className="text-[16px] font-extrabold text-[#222222] mb-3 tracking-[-0.02em]">언어를 선택하세요</h3>
                                <div className="space-y-0.5">
                                    {languages.map((lang) => (
                                        <button
                                            key={lang.value}
                                            onClick={() => setSelectedLanguage(lang.value)}
                                            className={`flex items-center justify-between w-full px-2.5 py-[10px] rounded-[12px] text-left transition-colors ${selectedLanguage === lang.value ? 'bg-[#F5F5F5]' : 'hover:bg-[#F7F7F7]'
                                                }`}
                                            style={selectedLanguage === lang.value ? { border: '1px solid #222222' } : { border: '1px solid transparent' }}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-[26px] h-[18px] rounded-[4px] overflow-hidden flex items-center justify-center bg-white border border-[#E5E5E5]">
                                                    <img src={`https://flagcdn.com/w40/${lang.code}.png`} alt={lang.label} className="w-full h-full object-cover" />
                                                </div>
                                                <div>
                                                    <span className="text-[12px] font-semibold text-[#222222] block">{lang.label}</span>
                                                    <span className="text-[10px] text-[#8B8B8B] font-normal">{lang.sub}</span>
                                                </div>
                                            </div>
                                            <div className={`w-[18px] h-[18px] rounded-full border flex items-center justify-center ${selectedLanguage === lang.value ? 'border-[#222222] bg-[#222222]' : 'border-[#CFCFCF] bg-white'}`}>
                                                {selectedLanguage === lang.value && <div className="w-[6px] h-[6px] rounded-full bg-white" />}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="mb-2">
                    <CollapsedPanel label="언어" value={getLanguageLabel()} placeholder="언어 선택" panelKey="language" />
                        </div>
                    )}
                </div>

                {/* 하단 고정 바 */}
                <div
                    className="fixed bottom-0 left-0 right-0 bg-white flex items-center justify-between px-5 py-3 z-[210]"
                    style={{ borderTop: '1px solid #EBEBEB', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
                >
                    <button onClick={handleClearAll} className="text-[13px] font-bold text-[#222222] underline underline-offset-[3px]">
                        {t('mobile_clear_all')}
                    </button>
                    <button
                        onClick={handleSearch}
                        className="flex items-center gap-1.5 text-white px-5 py-[11px] rounded-[10px] text-[13px] font-bold active:scale-[0.97] transition-transform"
                        style={{ background: 'linear-gradient(to right, #E61E4D 0%, #E31C5F 50%, #D70466 100%)' }}
                    >
                        <Search size={13} strokeWidth={2.5} />
                        {t('search')}
                    </button>
                </div>
            </div>
        </div>
    );
}
