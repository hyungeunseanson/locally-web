'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Search, X, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/app/context/LanguageContext';
import DatePicker from '@/app/components/DatePicker';
import { createPortal } from 'react-dom';

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
}

export default function MobileSearchModal({
    isOpen, onClose, activeTab, setActiveTab,
    locationInput, setLocationInput,
    dateRange, setDateRange,
    selectedLanguage, setSelectedLanguage,
}: MobileSearchModalProps) {
    const { t } = useLanguage();
    const router = useRouter();
    const [activePanel, setActivePanel] = useState<'location' | 'date' | 'language' | null>('location');
    const [isVisible, setIsVisible] = useState(false);
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const [recentSearches, setRecentSearches] = useState<{ name: string; desc?: string }[]>([]);
    const scrollLockRef = useRef({
        locked: false,
        scrollY: 0,
        bodyOverflow: '',
        htmlOverflow: '',
        bodyPosition: '',
        bodyTop: '',
        bodyLeft: '',
        bodyRight: '',
        bodyWidth: '',
    });

    const normalizeText = (value: string) => value.toLowerCase().replace(/\s+/g, '').trim();
    const inferPlaceType = (name: string): string => {
        const value = normalizeText(name);
        if (value.includes('도쿄') || value.includes('tokyo')) return 'tokyo';
        if (value.includes('오사카') || value.includes('osaka')) return 'osaka';
        if (value.includes('서울') || value.includes('seoul')) return 'seoul';
        if (value.includes('이자카야') || value.includes('izakaya')) return 'izakaya';
        return 'custom';
    };

    useEffect(() => {
        if (isOpen) {
            setActivePanel('location');
            setIsSearchExpanded(false);
            if (!selectedLanguage) {
                setSelectedLanguage('한국어');
            }
            requestAnimationFrame(() => setIsVisible(true));
        } else {
            setIsVisible(false);
        }
    }, [isOpen, selectedLanguage, setSelectedLanguage]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const stored = window.localStorage.getItem('locally_recent_searches');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) setRecentSearches(parsed.slice(0, 6));
            }
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const body = document.body;
        const html = document.documentElement;
        const restoreScrollLock = () => {
            if (!scrollLockRef.current.locked) return;
            body.style.overflow = scrollLockRef.current.bodyOverflow;
            html.style.overflow = scrollLockRef.current.htmlOverflow;
            body.style.position = scrollLockRef.current.bodyPosition;
            body.style.top = scrollLockRef.current.bodyTop;
            body.style.left = scrollLockRef.current.bodyLeft;
            body.style.right = scrollLockRef.current.bodyRight;
            body.style.width = scrollLockRef.current.bodyWidth;
            window.scrollTo(0, scrollLockRef.current.scrollY);
            scrollLockRef.current.locked = false;
        };

        if (isOpen && !scrollLockRef.current.locked) {
            scrollLockRef.current = {
                locked: true,
                scrollY: window.scrollY,
                bodyOverflow: body.style.overflow,
                htmlOverflow: html.style.overflow,
                bodyPosition: body.style.position,
                bodyTop: body.style.top,
                bodyLeft: body.style.left,
                bodyRight: body.style.right,
                bodyWidth: body.style.width,
            };

            body.style.overflow = 'hidden';
            html.style.overflow = 'hidden';
            body.style.position = 'fixed';
            body.style.top = `-${scrollLockRef.current.scrollY}px`;
            body.style.left = '0';
            body.style.right = '0';
            body.style.width = '100%';
        }

        if (!isOpen) {
            restoreScrollLock();
        }

        return () => {
            if (isOpen) restoreScrollLock();
        };
    }, [isOpen]);

    if (!isOpen || typeof document === 'undefined') return null;

    const languages = [
        { label: '전체', value: 'all', sub: 'All', code: '' },
        { label: '한국어', value: '한국어', sub: 'Korean', code: 'kr' },
        { label: '영어', value: '영어', sub: 'English', code: 'us' },
        { label: '일본어', value: '일본어', sub: 'Japanese', code: 'jp' },
        { label: '중국어', value: '중국어', sub: 'Chinese', code: 'cn' },
    ];

    const recommendedPlaces = [
        { id: 'tokyo', name: '도쿄', desc: '도쿄 타워가 빛나는 곳' },
        { id: 'osaka', name: '오사카', desc: '미식과 야경이 살아있는 곳' },
        { id: 'izakaya', name: '이자카야', desc: '현지 밤문화를 맛보는 곳' },
        { id: 'seoul', name: '서울', desc: '감성이 스며든 곳' },
    ];

    const saveRecentSearch = (name: string) => {
        if (!name) return;
        const desc = formatDateRange() || undefined;
        const next = [{ name, desc }, ...recentSearches.filter(item => item.name !== name)].slice(0, 6);
        setRecentSearches(next);
        try {
            window.localStorage.setItem('locally_recent_searches', JSON.stringify(next));
        } catch {
            // ignore
        }
    };

    const selectLocation = (name: string, closeExpanded?: boolean) => {
        setLocationInput(name);
        saveRecentSearch(name);
        if (closeExpanded) setIsSearchExpanded(false);
        setActivePanel('date');
    };

    const submitTypedLocation = (closeExpanded?: boolean) => {
        const typed = locationInput.trim();
        if (!typed) return;
        selectLocation(typed, closeExpanded);
    };

    const PlaceIcon = ({ type }: { type: string }) => {
        const colors: Record<string, string> = {
            tokyo: '#EE7B7B',
            osaka: '#F2A15A',
            seoul: '#7CB0ED',
            izakaya: '#D5AE3D',
        };
        const stroke = colors[type] || '#6B7280';
        const sw = 1.0;
        const blurId = `icon-soft-${type}`;

        const paths = () => {
            if (type === 'tokyo') {
                return (
                    <>
                        <path d="M13 3V6.2" stroke={stroke} strokeWidth={sw} />
                        <path d="M11.1 6.2H14.9" stroke={stroke} strokeWidth={sw} />
                        <path d="M10.8 6.2L9.7 10.5H16.3L15.2 6.2" stroke={stroke} strokeWidth={sw} />
                        <path d="M8.7 12H17.3" stroke={stroke} strokeWidth={sw} />
                        <path d="M9.4 12V15.4" stroke={stroke} strokeWidth={sw} />
                        <path d="M16.6 12V15.4" stroke={stroke} strokeWidth={sw} />
                        <path d="M7.5 17.3H18.5" stroke={stroke} strokeWidth={sw} />
                        <path d="M6.2 22H19.8" stroke={stroke} strokeWidth={sw} />
                        <path d="M7.5 22L10.8 17.3" stroke={stroke} strokeWidth={sw} />
                        <path d="M18.5 22L15.2 17.3" stroke={stroke} strokeWidth={sw} />
                        <path d="M10.8 15.4H15.2" stroke={stroke} strokeWidth={sw} />
                    </>
                );
            }
            if (type === 'osaka') {
                return (
                    <>
                        <path d="M4.5 7.8C9.2 9.2 16.8 9.2 21.5 7.8" stroke={stroke} strokeWidth={sw} />
                        <path d="M5.4 10.2H20.6" stroke={stroke} strokeWidth={sw} />
                        <path d="M7.2 10.2V21.5" stroke={stroke} strokeWidth={sw} />
                        <path d="M18.8 10.2V21.5" stroke={stroke} strokeWidth={sw} />
                        <path d="M9.8 12.6H16.2" stroke={stroke} strokeWidth={sw} />
                        <path d="M8.5 15.8H17.5" stroke={stroke} strokeWidth={sw} />
                        <path d="M6.2 21.5H9.4" stroke={stroke} strokeWidth={sw} />
                        <path d="M16.6 21.5H19.8" stroke={stroke} strokeWidth={sw} />
                    </>
                );
            }
            if (type === 'seoul') {
                return (
                    <>
                        <path d="M13 2.8V6.1" stroke={stroke} strokeWidth={sw} />
                        <path d="M11.9 6.1H14.1" stroke={stroke} strokeWidth={sw} />
                        <path d="M11.3 6.1V9.2H14.7V6.1" stroke={stroke} strokeWidth={sw} />
                        <rect x="9.6" y="9.9" width="6.8" height="3.9" rx="0.8" stroke={stroke} strokeWidth={sw} />
                        <path d="M13 13.8V20.1" stroke={stroke} strokeWidth={sw} />
                        <path d="M10.3 16.6H15.7" stroke={stroke} strokeWidth={sw} />
                        <path d="M9.8 20.1H16.2" stroke={stroke} strokeWidth={sw} />
                        <path d="M7.7 22H18.3" stroke={stroke} strokeWidth={sw} />
                    </>
                );
            }
            if (type === 'custom') {
                return (
                    <>
                        <path d="M13 22C13 22 19 15.9 19 11.5C19 8.2 16.3 5.5 13 5.5C9.7 5.5 7 8.2 7 11.5C7 15.9 13 22 13 22Z" stroke={stroke} strokeWidth={sw} />
                        <circle cx="13" cy="11.5" r="2.2" stroke={stroke} strokeWidth={sw} />
                    </>
                );
            }
            return (
                <>
                    <rect x="8" y="6.2" width="8.8" height="13.5" rx="2.2" stroke={stroke} strokeWidth={sw} />
                    <path d="M16.8 9.2H18.6C19.7 9.2 20.5 10 20.5 11.1V15.4C20.5 16.5 19.7 17.3 18.6 17.3H16.8" stroke={stroke} strokeWidth={sw} />
                    <path d="M10.4 10V16.8" stroke={stroke} strokeWidth={sw} />
                    <path d="M12.4 10V16.8" stroke={stroke} strokeWidth={sw} />
                    <path d="M14.4 10V16.8" stroke={stroke} strokeWidth={sw} />
                    <path d="M9 5.3C9.6 4.3 10.8 4.3 11.4 5.3C12 6.3 13.2 6.3 13.8 5.3C14.4 4.3 15.6 4.3 16.2 5.3" stroke={stroke} strokeWidth={sw} />
                </>
            );
        };

        return (
            <svg width="24" height="24" viewBox="0 0 26 26" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <defs>
                    <filter id={blurId} x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur stdDeviation="0.4" />
                    </filter>
                </defs>
                <g opacity="0.2" filter={`url(#${blurId})`} transform="translate(0 0.5)">
                    {paths()}
                </g>
                <g>{paths()}</g>
            </svg>
        );
    };

    const PlaceBadge = ({ type }: { type: string }) => {
        const styles: Record<string, { bg: string; border: string }> = {
            tokyo: { bg: 'linear-gradient(135deg, #FDF0F0 0%, #FFF8F8 100%)', border: '#F3DFDF' },
            osaka: { bg: 'linear-gradient(135deg, #FEF3E8 0%, #FFF9F2 100%)', border: '#F4E3D1' },
            seoul: { bg: 'linear-gradient(135deg, #EEF5FD 0%, #F7FBFF 100%)', border: '#DBE8F6' },
            izakaya: { bg: 'linear-gradient(135deg, #FCF7E7 0%, #FFFBEF 100%)', border: '#EEE4C4' },
            custom: { bg: 'linear-gradient(135deg, #F1F4F8 0%, #FBFCFE 100%)', border: '#DEE5EE' },
        };
        const style = styles[type] || { bg: '#F3F4F6', border: '#E5E7EB' };
        return (
            <div
                className="w-[38px] h-[38px] rounded-[11px] flex items-center justify-center shrink-0"
                style={{
                    background: style.bg,
                    border: `1px solid ${style.border}`,
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55), 0 1px 2px rgba(0,0,0,0.03)',
                }}
            >
                <div style={{ filter: 'contrast(104%) saturate(98%)' }}>
                    <PlaceIcon type={type} />
                </div>
            </div>
        );
    };

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 250);
    };

    const handleSearch = () => {
        const typed = locationInput.trim();
        if (typed) {
            saveRecentSearch(typed);
        }
        setIsVisible(false);
        onClose();

        const params = new URLSearchParams({
            language: selectedLanguage || 'all',
        });
        if (typed) {
            params.set('location', typed);
        }
        if (dateRange.start) {
            params.set('startDate', dateRange.start.toISOString().split('T')[0]);
        }
        if (dateRange.end) {
            params.set('endDate', dateRange.end.toISOString().split('T')[0]);
        }
        router.push(`/search?${params.toString()}`);
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
        if (!selectedLanguage) return '';
        return languages.find(l => l.value === selectedLanguage)?.label || '';
    };

    const trimmedInput = locationInput.trim();
    const filteredRecommendedPlaces = recommendedPlaces.filter((place) => {
        if (!trimmedInput) return true;
        const normalizedInput = normalizeText(trimmedInput);
        return normalizeText(place.name).includes(normalizedInput) || normalizeText(place.desc).includes(normalizedInput);
    });
    const hasExactRecommendedMatch = !!trimmedInput && filteredRecommendedPlaces.some((place) => normalizeText(place.name) === normalizeText(trimmedInput));
    const showCustomTypedOption = !!trimmedInput && !hasExactRecommendedMatch;

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
        const expandedView = (
            <div className="fixed inset-0 z-[200] flex flex-col h-[100dvh] relative bg-[#F7F7F7]">
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
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                submitTypedLocation(true);
                            }
                        }}
                        className="flex-1 bg-transparent text-[14px] text-[#222222] outline-none placeholder:text-[#B0B0B0] font-normal"
                        autoFocus
                    />
                    {trimmedInput && (
                        <button
                            onClick={() => submitTypedLocation(true)}
                            className="shrink-0 text-[12px] font-semibold text-[#222222]"
                        >
                            선택
                        </button>
                    )}
                </div>

                {/* 검색 결과 리스트 */}
                <div className="flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-24">
                    {/* 최근 검색 */}
                    <div className="mb-5">
                        <p className="text-[10px] font-semibold text-[#717171] mb-2 px-1 tracking-[0.04em]">최근 검색</p>
                        {recentSearches.slice(0, 1).map((item, idx) => (
                            <button
                                key={`${item.name}-${idx}`}
                                onClick={() => selectLocation(item.name, true)}
                                className="flex items-center gap-3 w-full py-[10px] px-1 text-left active:bg-[#EDEDED] rounded-xl transition-colors"
                            >
                                <PlaceBadge type={inferPlaceType(item.name)} />
                                <div>
                                    <span className="text-[13px] font-semibold text-[#222222] block">{item.name}</span>
                                    {item.desc && <span className="text-[11px] text-[#8B8B8B] font-normal">{item.desc}</span>}
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* 추천 여행지 */}
                    <div>
                        <p className="text-[10px] font-semibold text-[#717171] mb-2 px-1 tracking-[0.04em]">추천 여행지</p>
                        {showCustomTypedOption && (
                            <button
                                onClick={() => submitTypedLocation(true)}
                                className="flex items-center gap-3 w-full py-[10px] px-1 text-left active:bg-[#EDEDED] rounded-xl transition-colors"
                            >
                                <PlaceBadge type="custom" />
                                <div>
                                    <span className="text-[13px] font-semibold text-[#222222] block">{trimmedInput}</span>
                                    <span className="text-[11px] text-[#7A7A7A] font-normal">직접 입력한 위치/체험 검색어</span>
                                </div>
                            </button>
                        )}
                        {filteredRecommendedPlaces
                            .map((place, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => selectLocation(place.name, true)}
                                    className="flex items-center gap-3 w-full py-[10px] px-1 text-left active:bg-[#EDEDED] rounded-xl transition-colors"
                                >
                                    <PlaceBadge type={place.id} />
                                    <div>
                                        <span className="text-[13px] font-semibold text-[#222222] block">{place.name}</span>
                                        <span className="text-[11px] text-[#7A7A7A] font-normal">{place.desc}</span>
                                    </div>
                                </button>
                            ))}
                        {filteredRecommendedPlaces.length === 0 && !showCustomTypedOption && (
                            <div className="px-1 py-2 text-[11px] text-[#8B8B8B]">일치하는 추천 항목이 없어요.</div>
                        )}
                    </div>
                </div>
            </div>
        );
        return createPortal(expandedView, document.body);
    }

    const modalView = (
        <div className="fixed inset-0 z-[200] flex flex-col h-[100dvh]">
            {/* 배경: 화면이 보이는 반투명 레이어 + 블러 */}
            <div
                className="absolute inset-0 -z-10 backdrop-blur-[10px] transition-opacity duration-500"
                style={{
                    background: 'rgba(255,255,255,0.18)',
                    opacity: isVisible ? 1 : 0,
                }}
            />

            {/* 콘텐츠 슬라이드업 */}
            <div
                className="flex flex-col flex-1 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
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
                <div className="flex-1 overflow-y-auto px-4 pt-2 pb-[120px]">
                    {/* 위치 패널 */}
                    {activePanel === 'location' ? (
                        <div
                            className="bg-white mb-2 overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
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
                                    {recentSearches.slice(0, 1).map((item, idx) => (
                                        <button
                                            key={`${item.name}-${idx}`}
                                            onClick={() => selectLocation(item.name)}
                                            className="flex items-center gap-2.5 w-full py-[8px] text-left active:bg-[#F3F3F3] rounded-lg transition-colors"
                                        >
                                            <PlaceBadge type={inferPlaceType(item.name)} />
                                            <div>
                                                <span className="text-[12px] font-semibold text-[#222222] block">{item.name}</span>
                                                {item.desc && <span className="text-[10px] text-[#8B8B8B] font-normal">{item.desc}</span>}
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                <div className="mt-4">
                                    <p className="text-[9px] font-semibold text-[#7A7A7A] mb-2 tracking-[0.04em]">추천 여행지</p>
                                    {recommendedPlaces.map((place) => (
                                        <button
                                            key={place.id}
                                            onClick={() => selectLocation(place.name)}
                                            className="flex items-center gap-2.5 w-full py-[8px] text-left active:bg-[#F3F3F3] rounded-lg transition-colors"
                                        >
                                            <PlaceBadge type={place.id} />
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
                            className="bg-white mb-2 overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
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
                            className="bg-white mb-2 overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                            style={{ borderRadius: '22px', boxShadow: '0 2px 6px rgba(0,0,0,0.05), 0 8px 18px rgba(0,0,0,0.06)', border: '0.5px solid #E6E6E6' }}
                        >
                            <div className="p-5">
                                <h3 className="text-[16px] font-extrabold text-[#222222] mb-3 tracking-[-0.02em]">진행 언어</h3>
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
                                                    {lang.code ? (
                                                        <img src={`https://flagcdn.com/w40/${lang.code}.png`} alt={lang.label} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                                            <circle cx="12" cy="12" r="9" stroke="#6B7280" strokeWidth="1.6" />
                                                            <path d="M3 12H21" stroke="#6B7280" strokeWidth="1.2" />
                                                            <path d="M12 3C14.5 5.5 15.9 8.5 15.9 12C15.9 15.5 14.5 18.5 12 21" stroke="#6B7280" strokeWidth="1.2" />
                                                            <path d="M12 3C9.5 5.5 8.1 8.5 8.1 12C8.1 15.5 9.5 18.5 12 21" stroke="#6B7280" strokeWidth="1.2" />
                                                        </svg>
                                                    )}
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
                    className="fixed left-0 right-0 bg-white flex items-center justify-between px-5 py-3 z-[210]"
                    style={{
                        borderTop: '1px solid #EBEBEB',
                        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
                        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 30px)',
                        boxShadow: '0 -6px 18px rgba(0,0,0,0.08)',
                    }}
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
    return createPortal(modalView, document.body);
}
