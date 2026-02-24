'use client';

import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { CATEGORIES } from '@/app/constants';
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

    useEffect(() => {
        if (isOpen) {
            setActivePanel('location');
            requestAnimationFrame(() => setIsVisible(true));
        } else {
            setIsVisible(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const languages = [
        { label: '모든 언어', value: 'all', icon: '🌐' },
        { label: '한국어', value: '한국어', code: 'kr' },
        { label: 'English', value: '영어', code: 'us' },
        { label: '日本語', value: '일본어', code: 'jp' },
        { label: '中文', value: '중국어', code: 'cn' },
    ];

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
        setSelectedLanguage('all');
    };

    const formatDateRange = () => {
        if (dateRange.start && dateRange.end) {
            return `${dateRange.start.getMonth() + 1}월 ${dateRange.start.getDate()}일 - ${dateRange.end.getMonth() + 1}월 ${dateRange.end.getDate()}일`;
        }
        if (dateRange.start) return `${dateRange.start.getMonth() + 1}월 ${dateRange.start.getDate()}일`;
        return '';
    };

    const getLanguageLabel = () => {
        if (!selectedLanguage || selectedLanguage === 'all') return '';
        return languages.find(l => l.value === selectedLanguage)?.label || '';
    };

    // 접힌 패널 — 에어비앤비 컴팩트한 카드형
    const CollapsedPanel = ({ label, value, placeholder, panelKey }: { label: string; value: string; placeholder: string; panelKey: 'location' | 'date' | 'language' }) => (
        <button
            onClick={() => setActivePanel(panelKey)}
            className="w-full bg-white flex items-center justify-between px-5 py-[14px] text-left active:scale-[0.99] transition-transform"
            style={{
                borderRadius: '14px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05)',
                border: '0.5px solid #EBEBEB',
            }}
        >
            <span className="text-[12px] text-[#717171] font-normal">{label}</span>
            <span className="text-[12px] text-[#222222] font-semibold">{value || placeholder}</span>
        </button>
    );

    return (
        <div className="fixed inset-0 z-[200] flex flex-col">
            {/* 배경 블러 + 부드러운 전환 */}
            <div
                className="absolute inset-0 -z-10 backdrop-blur-[6px] transition-opacity duration-300"
                style={{
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(247,247,247,0.94) 25%, rgba(240,240,240,0.88) 100%)',
                    opacity: isVisible ? 1 : 0,
                }}
            />

            {/* 콘텐츠 슬라이드업 */}
            <div
                className="flex flex-col flex-1 transition-all duration-300 ease-out"
                style={{
                    transform: isVisible ? 'translateY(0)' : 'translateY(16px)',
                    opacity: isVisible ? 1 : 0,
                }}
            >
                {/* 🔝 상단 헤더 */}
                <div className="flex items-end justify-between px-5 pt-[calc(env(safe-area-inset-top,0px)+12px)] pb-3" style={{ background: 'rgba(255,255,255,0.9)' }}>
                    <div className="flex items-center gap-6">
                        {/* 체험 */}
                        <button onClick={() => setActiveTab('experience')} className="flex flex-col items-center relative active:scale-[0.92] transition-transform duration-150">
                            <div className="w-[44px] h-[44px] flex items-center justify-center relative mb-[2px]">
                                <img
                                    src="https://a0.muscache.com/im/pictures/airbnb-platform-assets/AirbnbPlatformAssets-search-bar-icons/original/e47ab655-027b-4679-b2e6-df1c99a5c33d.png?im_w=240"
                                    alt="체험" className={`w-full h-full object-contain transition-opacity ${activeTab !== 'experience' ? 'opacity-35' : 'opacity-100'}`}
                                />
                            </div>
                            <span className={`text-[9px] tracking-[0.02em] ${activeTab === 'experience' ? 'text-[#222222] font-bold' : 'text-[#717171] font-normal'}`}>
                                {t('cat_exp')}
                            </span>
                            {activeTab === 'experience' && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-[2px] bg-[#222222] rounded-full" />}
                        </button>
                        {/* 서비스 */}
                        <button onClick={() => setActiveTab('service')} className="flex flex-col items-center relative active:scale-[0.92] transition-transform duration-150">
                            <div className="w-[44px] h-[44px] flex items-center justify-center relative mb-[2px]">
                                <img
                                    src="https://a0.muscache.com/im/pictures/airbnb-platform-assets/AirbnbPlatformAssets-search-bar-icons/original/3d67e9a9-520a-49ee-b439-7b3a75ea814d.png?im_w=240"
                                    alt="서비스" className={`w-full h-full object-contain transition-opacity ${activeTab !== 'service' ? 'opacity-35' : 'opacity-100'}`}
                                />
                            </div>
                            <span className={`text-[9px] tracking-[0.02em] ${activeTab === 'service' ? 'text-[#222222] font-bold' : 'text-[#717171] font-normal'}`}>
                                {t('cat_service')}
                            </span>
                            {activeTab === 'service' && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-[2px] bg-[#222222] rounded-full" />}
                        </button>
                    </div>

                    {/* X 닫기 버튼 */}
                    <button
                        onClick={handleClose}
                        className="w-[28px] h-[28px] rounded-full flex items-center justify-center bg-white shrink-0 active:scale-[0.9] transition-transform"
                        style={{ border: '1px solid #B0B0B0' }}
                    >
                        <X size={11} className="text-[#222222]" strokeWidth={3} />
                    </button>
                </div>

                {/* 📋 메인 콘텐츠 — 컴팩트한 여백 */}
                <div className="flex-1 overflow-y-auto px-5 pt-2 pb-28">
                    {/* 위치 패널 */}
                    {activePanel === 'location' ? (
                        <div
                            className="bg-white mb-2.5 overflow-hidden"
                            style={{ borderRadius: '20px', boxShadow: '0 2px 6px rgba(0,0,0,0.05), 0 6px 20px rgba(0,0,0,0.08)', border: '0.5px solid #EBEBEB' }}
                        >
                            <div className="p-5 pb-4">
                                <h3 className="text-[18px] font-extrabold text-[#222222] mb-4 tracking-[-0.02em]">위치</h3>
                                <div className="flex items-center gap-2.5 bg-[#F7F7F7] rounded-[10px] px-3.5 py-[11px]" style={{ border: '1px solid #DDDDDD' }}>
                                    <Search size={14} className="text-[#717171] shrink-0" strokeWidth={2} />
                                    <input
                                        type="text"
                                        placeholder="도시나 명소로 검색"
                                        value={locationInput}
                                        onChange={(e) => setLocationInput(e.target.value)}
                                        className="flex-1 bg-transparent text-[13px] text-[#222222] outline-none placeholder:text-[#717171] placeholder:font-normal font-normal"
                                        autoFocus
                                    />
                                </div>

                                <div className="mt-4">
                                    <p className="text-[11px] font-semibold text-[#717171] mb-2 tracking-[0.04em]">최근 검색</p>
                                    {CATEGORIES.filter(c => c.id !== 'all').slice(0, 5).map((city) => (
                                        <button
                                            key={city.id}
                                            onClick={() => { setLocationInput(t(city.label)); setActivePanel('date'); }}
                                            className="flex items-center gap-3 w-full py-[8px] text-left active:bg-[#F7F7F7] rounded-lg transition-colors"
                                        >
                                            <div
                                                className="w-[40px] h-[40px] rounded-[10px] flex items-center justify-center text-base shrink-0"
                                                style={{ background: '#F7F7F7', border: '0.5px solid #EBEBEB' }}
                                            >
                                                {city.icon}
                                            </div>
                                            <span className="text-[13px] font-medium text-[#222222]">{t(city.label)}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="mb-2.5">
                            <CollapsedPanel label="위치" value={locationInput} placeholder="어디든지" panelKey="location" />
                        </div>
                    )}

                    {/* 날짜 패널 */}
                    {activePanel === 'date' ? (
                        <div
                            className="bg-white mb-2.5 overflow-hidden"
                            style={{ borderRadius: '20px', boxShadow: '0 2px 6px rgba(0,0,0,0.05), 0 6px 20px rgba(0,0,0,0.08)', border: '0.5px solid #EBEBEB' }}
                        >
                            <div className="p-5">
                                <h3 className="text-[18px] font-extrabold text-[#222222] mb-4 tracking-[-0.02em]">날짜</h3>
                                <DatePicker
                                    selectedRange={dateRange}
                                    onChange={(range) => {
                                        setDateRange(range);
                                        if (range.start && range.end) setActivePanel('language');
                                    }}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="mb-2.5">
                            <CollapsedPanel label="날짜" value={formatDateRange()} placeholder="날짜 추가" panelKey="date" />
                        </div>
                    )}

                    {/* 언어 패널 */}
                    {activePanel === 'language' ? (
                        <div
                            className="bg-white mb-2.5 overflow-hidden"
                            style={{ borderRadius: '20px', boxShadow: '0 2px 6px rgba(0,0,0,0.05), 0 6px 20px rgba(0,0,0,0.08)', border: '0.5px solid #EBEBEB' }}
                        >
                            <div className="p-5">
                                <h3 className="text-[18px] font-extrabold text-[#222222] mb-4 tracking-[-0.02em]">언어</h3>
                                <div className="space-y-0.5">
                                    {languages.map((lang) => (
                                        <button
                                            key={lang.value}
                                            onClick={() => setSelectedLanguage(lang.value)}
                                            className={`flex items-center gap-2.5 w-full p-2.5 rounded-[10px] text-left transition-colors ${selectedLanguage === lang.value ? 'bg-[#F7F7F7]' : 'hover:bg-[#F7F7F7]'
                                                }`}
                                            style={selectedLanguage === lang.value ? { border: '1px solid #222222' } : { border: '1px solid transparent' }}
                                        >
                                            <div className="w-[28px] h-[20px] rounded-[3px] overflow-hidden flex items-center justify-center bg-[#F7F7F7] border border-[#EBEBEB]">
                                                {lang.icon ? (
                                                    <span className="text-[12px]">{lang.icon}</span>
                                                ) : (
                                                    <img src={`https://flagcdn.com/w40/${lang.code}.png`} alt={lang.label} className="w-full h-full object-cover" />
                                                )}
                                            </div>
                                            <span className="text-[13px] font-normal text-[#222222]">{lang.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="mb-2.5">
                            <CollapsedPanel label="언어" value={getLanguageLabel()} placeholder="언어 선택" panelKey="language" />
                        </div>
                    )}
                </div>

                {/* 🔻 하단 고정 바 */}
                <div
                    className="fixed bottom-0 left-0 right-0 bg-white flex items-center justify-between px-5 py-3 z-[210]"
                    style={{ borderTop: '1px solid #EBEBEB', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
                >
                    <button onClick={handleClearAll} className="text-[14px] font-bold text-[#222222] underline underline-offset-[3px]">
                        전체 해제
                    </button>
                    <button
                        onClick={handleSearch}
                        className="flex items-center gap-1.5 text-white px-5 py-[12px] rounded-[10px] text-[14px] font-bold active:scale-[0.97] transition-transform"
                        style={{ background: 'linear-gradient(to right, #E61E4D 0%, #E31C5F 50%, #D70466 100%)' }}
                    >
                        <Search size={14} strokeWidth={2.5} />
                        검색
                    </button>
                </div>
            </div>
        </div>
    );
}
