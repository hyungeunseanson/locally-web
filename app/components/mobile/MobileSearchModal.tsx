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

    useEffect(() => {
        if (isOpen) setActivePanel('location');
    }, [isOpen]);

    if (!isOpen) return null;

    const languages = [
        { label: '모든 언어', value: 'all', icon: '🌐' },
        { label: '한국어', value: '한국어', code: 'kr' },
        { label: 'English', value: '영어', code: 'us' },
        { label: '日本語', value: '일본어', code: 'jp' },
        { label: '中文', value: '중국어', code: 'cn' },
    ];

    const handleSearch = () => {
        onSearch();
        onClose();
        if (locationInput) {
            router.push(`/search?location=${encodeURIComponent(locationInput)}&language=${selectedLanguage}`);
        }
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

    // 접힌 패널 — 에어비앤비 스타일 카드형
    const CollapsedPanel = ({ label, value, placeholder, panelKey }: { label: string; value: string; placeholder: string; panelKey: 'location' | 'date' | 'language' }) => (
        <button
            onClick={() => setActivePanel(panelKey)}
            className="w-full bg-white flex items-center justify-between px-6 py-[18px] text-left"
            style={{
                borderRadius: '16px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05)',
                border: '0.5px solid #EBEBEB',
            }}
        >
            <span className="text-[14px] text-[#717171] font-normal">{label}</span>
            <span className="text-[14px] text-[#222222] font-semibold">{value || placeholder}</span>
        </button>
    );

    return (
        <div className="fixed inset-0 z-[200] flex flex-col" style={{ background: 'rgba(0,0,0,0.02)' }}>
            {/* 배경 블러 */}
            <div className="absolute inset-0 -z-10 backdrop-blur-[2px]" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(247,247,247,0.95) 30%, rgba(247,247,247,0.9) 100%)' }} />

            {/* 🔝 상단 헤더: 아이콘 탭 + X 닫기 */}
            <div className="flex items-end justify-between px-6 pt-[calc(env(safe-area-inset-top,0px)+16px)] pb-4" style={{ background: 'rgba(255,255,255,0.95)' }}>
                <div className="flex items-center gap-7">
                    {/* 체험 */}
                    <button onClick={() => setActiveTab('experience')} className="flex flex-col items-center relative">
                        <div className="w-[48px] h-[48px] flex items-center justify-center relative mb-1">
                            <img
                                src="https://a0.muscache.com/im/pictures/airbnb-platform-assets/AirbnbPlatformAssets-search-bar-icons/original/e47ab655-027b-4679-b2e6-df1c99a5c33d.png?im_w=240"
                                alt="체험" className={`w-full h-full object-contain transition-opacity ${activeTab !== 'experience' ? 'opacity-40' : 'opacity-100'}`}
                            />
                        </div>
                        <span className={`text-[10px] font-semibold ${activeTab === 'experience' ? 'text-[#222222]' : 'text-[#717171]'}`}>
                            {t('cat_exp')}
                        </span>
                        {activeTab === 'experience' && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-[2px] bg-[#222222] rounded-full" />}
                    </button>
                    {/* 서비스 */}
                    <button onClick={() => setActiveTab('service')} className="flex flex-col items-center relative">
                        <div className="w-[48px] h-[48px] flex items-center justify-center relative mb-1">
                            <img
                                src="https://a0.muscache.com/im/pictures/airbnb-platform-assets/AirbnbPlatformAssets-search-bar-icons/original/3d67e9a9-520a-49ee-b439-7b3a75ea814d.png?im_w=240"
                                alt="서비스" className={`w-full h-full object-contain transition-opacity ${activeTab !== 'service' ? 'opacity-40' : 'opacity-100'}`}
                            />
                        </div>
                        <span className={`text-[10px] font-semibold ${activeTab === 'service' ? 'text-[#222222]' : 'text-[#717171]'}`}>
                            {t('cat_service')}
                        </span>
                        {activeTab === 'service' && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-[2px] bg-[#222222] rounded-full" />}
                    </button>
                </div>

                {/* X 닫기 버튼 — 에어비앤비 정확한 원형 */}
                <button
                    onClick={onClose}
                    className="w-[30px] h-[30px] rounded-full flex items-center justify-center bg-white shrink-0"
                    style={{ border: '1px solid #B0B0B0' }}
                >
                    <X size={12} className="text-[#222222]" strokeWidth={3} />
                </button>
            </div>

            {/* 📋 메인 콘텐츠 */}
            <div className="flex-1 overflow-y-auto px-5 pt-3 pb-32">
                {/* 🔍 위치 패널 */}
                {activePanel === 'location' ? (
                    <div
                        className="bg-white mb-3 overflow-hidden"
                        style={{
                            borderRadius: '24px',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.09)',
                            border: '0.5px solid #EBEBEB',
                        }}
                    >
                        <div className="p-6 pb-5">
                            <h3 className="text-[22px] font-extrabold text-[#222222] mb-5 tracking-[-0.02em]">위치</h3>
                            <div
                                className="flex items-center gap-3 bg-[#F7F7F7] rounded-[12px] px-4 py-[13px]"
                                style={{ border: '1px solid #DDDDDD' }}
                            >
                                <Search size={16} className="text-[#717171] shrink-0" strokeWidth={2} />
                                <input
                                    type="text"
                                    placeholder="도시나 명소로 검색"
                                    value={locationInput}
                                    onChange={(e) => setLocationInput(e.target.value)}
                                    className="flex-1 bg-transparent text-[15px] text-[#222222] outline-none placeholder:text-[#717171] placeholder:font-normal font-normal"
                                    autoFocus
                                />
                            </div>

                            {/* 최근 검색 */}
                            <div className="mt-6">
                                <p className="text-[12px] font-semibold text-[#717171] mb-3 tracking-[0.04em]">최근 검색</p>
                                {CATEGORIES.filter(c => c.id !== 'all').slice(0, 5).map((city) => (
                                    <button
                                        key={city.id}
                                        onClick={() => { setLocationInput(t(city.label)); setActivePanel('date'); }}
                                        className="flex items-center gap-3.5 w-full py-[10px] text-left"
                                    >
                                        <div
                                            className="w-[48px] h-[48px] rounded-[12px] flex items-center justify-center text-xl shrink-0"
                                            style={{ background: '#F7F7F7', border: '0.5px solid #EBEBEB' }}
                                        >
                                            {city.icon}
                                        </div>
                                        <span className="text-[15px] font-medium text-[#222222]">{t(city.label)}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="mb-3">
                        <CollapsedPanel label="위치" value={locationInput} placeholder="어디든지" panelKey="location" />
                    </div>
                )}

                {/* 📅 날짜 패널 */}
                {activePanel === 'date' ? (
                    <div
                        className="bg-white mb-3 overflow-hidden"
                        style={{
                            borderRadius: '24px',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.09)',
                            border: '0.5px solid #EBEBEB',
                        }}
                    >
                        <div className="p-6">
                            <h3 className="text-[22px] font-extrabold text-[#222222] mb-5 tracking-[-0.02em]">날짜</h3>
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
                    <div className="mb-3">
                        <CollapsedPanel label="날짜" value={formatDateRange()} placeholder="날짜 추가" panelKey="date" />
                    </div>
                )}

                {/* 🌐 언어 패널 */}
                {activePanel === 'language' ? (
                    <div
                        className="bg-white mb-3 overflow-hidden"
                        style={{
                            borderRadius: '24px',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.09)',
                            border: '0.5px solid #EBEBEB',
                        }}
                    >
                        <div className="p-6">
                            <h3 className="text-[22px] font-extrabold text-[#222222] mb-5 tracking-[-0.02em]">언어</h3>
                            <div className="space-y-0.5">
                                {languages.map((lang) => (
                                    <button
                                        key={lang.value}
                                        onClick={() => setSelectedLanguage(lang.value)}
                                        className={`flex items-center gap-3 w-full p-3 rounded-[12px] text-left transition-colors ${selectedLanguage === lang.value ? 'bg-[#F7F7F7]' : 'hover:bg-[#F7F7F7]'
                                            }`}
                                        style={selectedLanguage === lang.value ? { border: '1px solid #222222' } : { border: '1px solid transparent' }}
                                    >
                                        <div className="w-[32px] h-[24px] rounded-[4px] overflow-hidden flex items-center justify-center bg-[#F7F7F7] border border-[#EBEBEB]">
                                            {lang.icon ? (
                                                <span className="text-[14px]">{lang.icon}</span>
                                            ) : (
                                                <img src={`https://flagcdn.com/w40/${lang.code}.png`} alt={lang.label} className="w-full h-full object-cover" />
                                            )}
                                        </div>
                                        <span className="text-[15px] font-normal text-[#222222]">{lang.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="mb-3">
                        <CollapsedPanel label="언어" value={getLanguageLabel()} placeholder="언어 선택" panelKey="language" />
                    </div>
                )}
            </div>

            {/* 🔻 하단 고정 바 — 에어비앤비 정확 */}
            <div
                className="fixed bottom-0 left-0 right-0 bg-white flex items-center justify-between px-6 py-4 z-[210]"
                style={{
                    borderTop: '1px solid #EBEBEB',
                    paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
                }}
            >
                <button onClick={handleClearAll} className="text-[16px] font-bold text-[#222222] underline underline-offset-[3px]">
                    전체 해제
                </button>
                <button
                    onClick={handleSearch}
                    className="flex items-center gap-2 text-white px-6 py-[14px] rounded-[12px] text-[16px] font-bold active:scale-[0.97] transition-transform"
                    style={{
                        background: 'linear-gradient(to right, #E61E4D 0%, #E31C5F 50%, #D70466 100%)',
                    }}
                >
                    <Search size={16} strokeWidth={2.5} />
                    검색
                </button>
            </div>
        </div>
    );
}
