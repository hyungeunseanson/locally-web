'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface HostModeTransitionProps {
    targetMode: 'host' | 'guest';
    onComplete?: () => void;
}

// ─── 씬 1: 게스트→호스트 전환 (해변에서 셀카 찍는 친구들) ───────────────────
function BeachSelfieScene() {
    return (
        <svg viewBox="0 0 320 260" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <style>{`
                @keyframes wave-anim {
                    0%, 100% { transform: translateX(0) scaleY(1); }
                    50% { transform: translateX(10px) scaleY(1.07); }
                }
                @keyframes palm-sway {
                    0%, 100% { transform: rotate(0deg); }
                    50% { transform: rotate(6deg); }
                }
                @keyframes arm-wave {
                    0%, 100% { transform: rotate(0deg); }
                    50% { transform: rotate(-22deg); }
                }
                @keyframes phone-raise {
                    0%, 100% { transform: rotate(0deg); }
                    40% { transform: rotate(-18deg) translateY(-5px); }
                }
                @keyframes jump-up {
                    0%, 100% { transform: translateY(0); }
                    40% { transform: translateY(-9px); }
                }
                @keyframes flash-blink {
                    0%, 82%, 100% { opacity: 0; }
                    86%, 94% { opacity: 1; }
                }
                @keyframes cloud-move {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(18px); }
                }
                @keyframes sparkle-anim {
                    0%, 100% { opacity: 0; transform: scale(0.5); }
                    50% { opacity: 1; transform: scale(1); }
                }
                @keyframes laugh-pop {
                    0%, 100% { opacity: 0; transform: scale(0.5) translateY(4px); }
                    40%, 70% { opacity: 1; transform: scale(1) translateY(0); }
                }
                .wave1 { animation: wave-anim 2.4s ease-in-out infinite; }
                .wave2 { animation: wave-anim 2.4s ease-in-out infinite reverse; }
                .palm-top { animation: palm-sway 3s ease-in-out infinite; transform-origin: 70px 90px; }
                .p1-arm { animation: arm-wave 1.5s ease-in-out infinite; transform-origin: 116px 187px; }
                .p2-arm { animation: phone-raise 1.8s ease-in-out infinite; transform-origin: 166px 180px; }
                .p3-body { animation: jump-up 2s ease-in-out infinite; }
                .flash { animation: flash-blink 3.5s ease-in-out infinite; }
                .cloud1 { animation: cloud-move 10s ease-in-out infinite alternate; }
                .cloud2 { animation: cloud-move 14s ease-in-out infinite alternate-reverse; }
                .sp1 { animation: sparkle-anim 2s ease-in-out infinite; }
                .sp2 { animation: sparkle-anim 2s ease-in-out infinite 0.7s; }
                .sp3 { animation: sparkle-anim 2s ease-in-out infinite 1.4s; }
                .lg1 { animation: laugh-pop 2s ease-in-out infinite; }
                .lg2 { animation: laugh-pop 2s ease-in-out infinite 0.6s; }
            `}</style>

            <defs>
                <linearGradient id="sg1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#87CEEB" />
                    <stop offset="100%" stopColor="#D0EFFF" />
                </linearGradient>
                <linearGradient id="sea1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#29B6F6" />
                    <stop offset="100%" stopColor="#0277BD" />
                </linearGradient>
                <linearGradient id="sand1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F5DEB3" />
                    <stop offset="100%" stopColor="#D2B48C" />
                </linearGradient>
            </defs>

            {/* 하늘 */}
            <rect width="320" height="165" fill="url(#sg1)" />

            {/* 구름 */}
            <g className="cloud1">
                <ellipse cx="60" cy="38" rx="30" ry="13" fill="white" opacity="0.9" />
                <ellipse cx="80" cy="33" rx="22" ry="11" fill="white" opacity="0.9" />
            </g>
            <g className="cloud2">
                <ellipse cx="240" cy="28" rx="26" ry="11" fill="white" opacity="0.85" />
                <ellipse cx="258" cy="23" rx="18" ry="9" fill="white" opacity="0.85" />
            </g>

            {/* 태양 */}
            <circle cx="272" cy="42" r="20" fill="#FFD700" opacity="0.85" />
            <circle cx="272" cy="42" r="13" fill="#FFF176" />

            {/* 바다 */}
            <g className="wave1">
                <rect x="0" y="148" width="320" height="55" fill="url(#sea1)" opacity="0.92" />
            </g>
            <g className="wave2">
                <path d="M0 152 Q40 145 80 152 Q120 159 160 152 Q200 145 240 152 Q280 159 320 152 L320 200 L0 200Z" fill="#4FC3F7" opacity="0.5" />
            </g>

            {/* 모래사장 */}
            <rect x="0" y="175" width="320" height="85" fill="url(#sand1)" />

            {/* 반짝임 */}
            <g className="sp1"><circle cx="82" cy="202" r="2" fill="#FFD700" /></g>
            <g className="sp2"><circle cx="196" cy="197" r="1.5" fill="#FFD700" /></g>
            <g className="sp3"><circle cx="258" cy="212" r="2" fill="#FFD700" /></g>

            {/* 야자수 */}
            <path d="M68 255 Q70 205 72 165 Q74 144 70 122" stroke="#8B4513" strokeWidth="5" fill="none" strokeLinecap="round" />
            <g className="palm-top">
                <ellipse cx="70" cy="118" rx="28" ry="8" fill="#2E7D32" transform="rotate(-28 70 118)" />
                <ellipse cx="70" cy="118" rx="28" ry="8" fill="#388E3C" transform="rotate(12 70 118)" />
                <ellipse cx="70" cy="118" rx="28" ry="8" fill="#43A047" transform="rotate(52 70 118)" />
                <ellipse cx="70" cy="118" rx="28" ry="8" fill="#1B5E20" transform="rotate(-68 70 118)" />
                <circle cx="70" cy="118" r="8" fill="#8B4513" />
            </g>

            {/* ── 사람 1 (왼쪽, 분홍 원피스 여성) ── */}
            <g>
                <ellipse cx="126" cy="198" rx="10" ry="14" fill="#FF69B4" />
                <rect x="120" y="210" width="5" height="17" fill="#FDBCB4" rx="2" />
                <rect x="127" y="210" width="5" height="17" fill="#FDBCB4" rx="2" />
                <g className="p1-arm">
                    <line x1="116" y1="192" x2="108" y2="204" stroke="#FDBCB4" strokeWidth="4" strokeLinecap="round" />
                </g>
                <line x1="136" y1="190" x2="144" y2="180" stroke="#FDBCB4" strokeWidth="4" strokeLinecap="round" />
                <circle cx="126" cy="182" r="11" fill="#FDBCB4" />
                <path d="M115 179 Q116 167 126 166 Q136 167 137 177" fill="#7B3F00" />
                <circle cx="122" cy="181" r="1.5" fill="#222" />
                <circle cx="130" cy="181" r="1.5" fill="#222" />
                <path d="M121 185 Q126 189 131 185" stroke="#333" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                <ellipse cx="126" cy="228" rx="9" ry="3" fill="#0002" />
            </g>

            {/* ── 사람 2 (가운데, 셀카봉/폰 들기) ── */}
            <g>
                <g className="p2-arm">
                    <line x1="166" y1="178" x2="176" y2="160" stroke="#DEB887" strokeWidth="4" strokeLinecap="round" />
                    <rect x="173" y="150" width="10" height="15" fill="#222" rx="2" />
                    <rect x="174" y="151" width="8" height="13" fill="#4FC3F7" rx="1" />
                    <g className="flash">
                        <circle cx="178" cy="157" r="7" fill="white" opacity="0.85" />
                    </g>
                </g>
                <ellipse cx="164" cy="198" rx="11" ry="15" fill="#1565C0" />
                <rect x="158" y="211" width="5" height="17" fill="#DEB887" rx="2" />
                <rect x="165" y="211" width="5" height="17" fill="#DEB887" rx="2" />
                <line x1="153" y1="192" x2="145" y2="204" stroke="#DEB887" strokeWidth="4" strokeLinecap="round" />
                <circle cx="164" cy="180" r="12" fill="#DEB887" />
                <path d="M152 177 Q153 165 164 164 Q175 165 176 175" fill="#3E1F00" />
                <circle cx="160" cy="179" r="1.5" fill="#222" />
                <circle cx="168" cy="179" r="1.5" fill="#222" />
                <path d="M159 184 Q164 188 169 184" stroke="#333" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                <circle cx="157" cy="182" r="3" fill="#FF9999" opacity="0.45" />
                <circle cx="171" cy="182" r="3" fill="#FF9999" opacity="0.45" />
                <ellipse cx="164" cy="229" rx="10" ry="3" fill="#0002" />
            </g>

            {/* ── 사람 3 (오른쪽, 점프!) ── */}
            <g className="p3-body">
                <ellipse cx="204" cy="196" rx="10" ry="14" fill="#FF7043" />
                <path d="M198 209 Q194 218 190 223" stroke="#FDBCB4" strokeWidth="4" fill="none" strokeLinecap="round" />
                <path d="M210 209 Q214 218 218 223" stroke="#FDBCB4" strokeWidth="4" fill="none" strokeLinecap="round" />
                <line x1="195" y1="189" x2="185" y2="177" stroke="#FDBCB4" strokeWidth="4" strokeLinecap="round" />
                <line x1="213" y1="189" x2="223" y2="177" stroke="#FDBCB4" strokeWidth="4" strokeLinecap="round" />
                <circle cx="204" cy="181" r="11" fill="#FDBCB4" />
                <path d="M193 178 Q194 165 204 164 Q214 165 215 175" fill="#111" />
                <circle cx="200" cy="180" r="1.5" fill="#222" />
                <circle cx="208" cy="180" r="1.5" fill="#222" />
                <path d="M199 185 Q204 190 209 185" stroke="#333" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </g>

            {/* 웃음 이모지 */}
            <g className="lg1" style={{ transformOrigin: '145px 165px' }}>
                <text x="138" y="168" fontSize="11">😄</text>
            </g>
            <g className="lg2" style={{ transformOrigin: '195px 160px' }}>
                <text x="188" y="163" fontSize="11">✨</text>
            </g>
        </svg>
    );
}

// ─── 씬 2: 호스트→게스트 전환 (집 앞에서 환영하는 호스트 + 여행자) ────────
function HomeWelcomeScene() {
    return (
        <svg viewBox="0 0 320 260" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <style>{`
                @keyframes host-wave {
                    0%, 100% { transform: rotate(0deg); }
                    50% { transform: rotate(30deg); }
                }
                @keyframes walk-step {
                    0%, 100% { transform: rotate(14deg); }
                    50% { transform: rotate(-14deg); }
                }
                @keyframes body-bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-3px); }
                }
                @keyframes bag-sway {
                    0%, 100% { transform: rotate(0deg); }
                    50% { transform: rotate(8deg); }
                }
                @keyframes window-glow {
                    0%, 100% { fill: #FFF9C4; opacity: 0.9; }
                    50% { fill: #FFEE58; opacity: 1; }
                }
                @keyframes welcome-pop {
                    0%, 100% { opacity: 0; transform: scale(0.5) translateY(6px); }
                    35%, 70% { opacity: 1; transform: scale(1) translateY(0); }
                }
                @keyframes bird-fly {
                    0% { transform: translate(0, 0); }
                    50% { transform: translate(22px, -8px); }
                    100% { transform: translate(0, 0); }
                }
                @keyframes smoke {
                    0% { opacity: 0.5; transform: translateY(0) scale(1); }
                    100% { opacity: 0; transform: translateY(-15px) scale(1.4); }
                }
                .hw-arm { animation: host-wave 1.2s ease-in-out infinite; transform-origin: 237px 192px; }
                .tleg1 { animation: walk-step 0.75s ease-in-out infinite; transform-origin: 90px 212px; }
                .tleg2 { animation: walk-step 0.75s ease-in-out infinite reverse; transform-origin: 100px 212px; }
                .tbody { animation: body-bounce 0.75s ease-in-out infinite; }
                .bag { animation: bag-sway 0.75s ease-in-out infinite; transform-origin: 76px 196px; }
                .wlight { animation: window-glow 2.5s ease-in-out infinite; }
                .wlp { animation: welcome-pop 2.5s ease-in-out infinite; }
                .bird { animation: bird-fly 3s ease-in-out infinite; }
                .smk1 { animation: smoke 2s ease-in-out infinite; }
                .smk2 { animation: smoke 2s ease-in-out infinite 0.6s; }
                .smk3 { animation: smoke 2s ease-in-out infinite 1.2s; }
            `}</style>

            <defs>
                <linearGradient id="hsg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FFF3E0" />
                    <stop offset="100%" stopColor="#FFF8E1" />
                </linearGradient>
            </defs>

            {/* 하늘 */}
            <rect width="320" height="180" fill="url(#hsg)" />

            {/* 저녁 태양 */}
            <circle cx="48" cy="52" r="26" fill="#FF8F00" opacity="0.65" />
            <circle cx="48" cy="52" r="18" fill="#FFB300" opacity="0.8" />
            <circle cx="48" cy="52" r="12" fill="#FFD54F" />

            {/* 새 */}
            <g className="bird">
                <path d="M245 55 Q252 50 260 53" stroke="#777" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                <path d="M262 53 Q269 48 277 51" stroke="#777" strokeWidth="1.8" fill="none" strokeLinecap="round" />
            </g>

            {/* 잔디 */}
            <rect x="0" y="172" width="320" height="88" fill="#66BB6A" />
            <rect x="0" y="172" width="320" height="8" fill="#81C784" />

            {/* 길 */}
            <rect x="130" y="210" width="60" height="50" fill="#BDBDBD" />
            <rect x="156" y="210" width="8" height="50" fill="#E0E0E0" />

            {/* 집 */}
            <polygon points="90,118 162,68 234,118" fill="#C62828" />
            <polygon points="88,120 90,118 234,118 236,120" fill="#B71C1C" />
            <rect x="184" y="76" width="12" height="28" fill="#795548" />
            <rect x="182" y="73" width="16" height="5" fill="#5D4037" />
            {/* 연기 */}
            <circle cx="190" cy="70" r="4" fill="#BDBDBD" className="smk1" />
            <circle cx="188" cy="63" r="3.5" fill="#BDBDBD" className="smk2" />
            <circle cx="192" cy="57" r="3" fill="#BDBDBD" className="smk3" />

            {/* 집 벽 */}
            <rect x="92" y="117" width="140" height="93" fill="#FFF8E1" />
            <rect x="92" y="117" width="140" height="93" fill="none" stroke="#E0E0E0" strokeWidth="1.5" />

            {/* 창문 왼쪽 */}
            <rect x="104" y="133" width="32" height="28" fill="white" rx="3" stroke="#90A4AE" strokeWidth="1" />
            <rect x="104" y="133" width="32" height="28" rx="2" className="wlight" />
            <line x1="120" y1="133" x2="120" y2="161" stroke="#90A4AE" strokeWidth="1" />
            <line x1="104" y1="147" x2="136" y2="147" stroke="#90A4AE" strokeWidth="1" />

            {/* 창문 오른쪽 */}
            <rect x="188" y="133" width="32" height="28" fill="white" rx="3" stroke="#90A4AE" strokeWidth="1" />
            <rect x="188" y="133" width="32" height="28" rx="2" className="wlight" />
            <line x1="204" y1="133" x2="204" y2="161" stroke="#90A4AE" strokeWidth="1" />
            <line x1="188" y1="147" x2="220" y2="147" stroke="#90A4AE" strokeWidth="1" />

            {/* 문 */}
            <rect x="148" y="170" width="28" height="40" fill="#795548" rx="2" />
            <rect x="148" y="170" width="28" height="40" fill="none" stroke="#6D4C41" strokeWidth="1.5" rx="2" />
            <circle cx="171" cy="192" r="2.5" fill="#FFD700" />

            {/* 꽃 */}
            <rect x="99" y="188" width="2" height="17" fill="#4CAF50" />
            <circle cx="100" cy="186" r="5" fill="#E91E63" />
            <circle cx="100" cy="181" r="3" fill="#FFD700" />

            <rect x="222" y="188" width="2" height="17" fill="#4CAF50" />
            <circle cx="223" cy="186" r="5" fill="#FF7043" />
            <circle cx="223" cy="181" r="3" fill="#FFD700" />

            {/* ── 호스트 (문 앞, 손 흔들기) ── */}
            <g>
                <ellipse cx="234" cy="191" rx="11" ry="15" fill="#AD1457" />
                <rect x="227" y="203" width="6" height="16" fill="#F48FB1" rx="2" />
                <rect x="235" y="203" width="6" height="16" fill="#F48FB1" rx="2" />
                <g className="hw-arm">
                    <line x1="245" y1="183" x2="258" y2="169" stroke="#F48FB1" strokeWidth="4" strokeLinecap="round" />
                    <circle cx="259" cy="167" r="5" fill="#F48FB1" />
                </g>
                <line x1="223" y1="186" x2="214" y2="196" stroke="#F48FB1" strokeWidth="4" strokeLinecap="round" />
                <circle cx="234" cy="174" r="12" fill="#F48FB1" />
                <path d="M222 170 Q223 159 234 158 Q245 159 246 168" fill="#4A148C" />
                <circle cx="230" cy="173" r="1.5" fill="#222" />
                <circle cx="238" cy="173" r="1.5" fill="#222" />
                <path d="M229 178 Q234 183 239 178" stroke="#333" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                <circle cx="227" cy="176" r="3" fill="#FF9999" opacity="0.4" />
                <circle cx="241" cy="176" r="3" fill="#FF9999" opacity="0.4" />
                <ellipse cx="234" cy="220" rx="10" ry="3" fill="#0002" />
            </g>

            {/* ── 여행자 (왼쪽, 가방 들고 걸어옴) ── */}
            <g className="tbody">
                <ellipse cx="95" cy="193" rx="11" ry="14" fill="#1976D2" />
                <g className="tleg1">
                    <rect x="88" y="205" width="6" height="18" fill="#DEB887" rx="2" />
                </g>
                <g className="tleg2">
                    <rect x="97" y="205" width="6" height="18" fill="#DEB887" rx="2" />
                </g>
                <line x1="106" y1="188" x2="117" y2="200" stroke="#DEB887" strokeWidth="4" strokeLinecap="round" />
                <line x1="84" y1="188" x2="74" y2="200" stroke="#DEB887" strokeWidth="4" strokeLinecap="round" />
                <g className="bag">
                    <rect x="60" y="190" width="16" height="20" fill="#6D4C41" rx="3" />
                    <rect x="63" y="186" width="10" height="6" fill="none" stroke="#795548" strokeWidth="2" rx="2" />
                    <line x1="60" y1="200" x2="76" y2="200" stroke="#A1887F" strokeWidth="1" />
                    <line x1="68" y1="190" x2="68" y2="210" stroke="#A1887F" strokeWidth="1" />
                </g>
                <circle cx="95" cy="177" r="12" fill="#DEB887" />
                <path d="M83 173 Q84 163 95 162 Q106 163 107 171" fill="#1A1A1A" />
                <circle cx="91" cy="176" r="1.5" fill="#222" />
                <circle cx="99" cy="176" r="1.5" fill="#222" />
                <path d="M90 181 Q95 185 100 181" stroke="#333" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                <circle cx="88" cy="179" r="3" fill="#FF9999" opacity="0.4" />
                <circle cx="102" cy="179" r="3" fill="#FF9999" opacity="0.4" />
                <ellipse cx="95" cy="224" rx="10" ry="3" fill="#0002" />
            </g>

            {/* 환영 이모지 */}
            <g className="wlp" style={{ transformOrigin: '165px 125px' }}>
                <text x="145" y="130" fontSize="24">🏡</text>
            </g>
        </svg>
    );
}

export default function HostModeTransition({ targetMode, onComplete }: HostModeTransitionProps) {
    const [visible, setVisible] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const t = setTimeout(() => {
            setVisible(false);
            if (targetMode === 'host') {
                router.push('/host/dashboard');
            } else {
                router.push('/');
            }
            onComplete?.();
        }, 3000);
        return () => clearTimeout(t);
    }, []);

    if (!visible) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white">
            <style>{`
                @keyframes scene-fade-in {
                    0% { opacity: 0; transform: scale(0.92); }
                    100% { opacity: 1; transform: scale(1); }
                }
                @keyframes text-fade-in {
                    0% { opacity: 0; transform: translateY(8px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
            `}</style>

            <div
                className="w-[300px] h-[240px]"
                style={{ animation: 'scene-fade-in 0.5s ease-out forwards' }}
            >
                {targetMode === 'host' ? <BeachSelfieScene /> : <HomeWelcomeScene />}
            </div>

            <p
                className="mt-4 text-[15px] font-semibold text-gray-700 tracking-tight"
                style={{ animation: 'text-fade-in 0.6s ease-out 0.3s both' }}
            >
                {targetMode === 'host' ? '호스트 모드로 전환 중' : '게스트 모드로 전환 중'}
            </p>
            <p
                className="mt-1 text-[12px] text-gray-400"
                style={{ animation: 'text-fade-in 0.6s ease-out 0.5s both' }}
            >
                {targetMode === 'host' ? '여행자들을 만나볼 준비를 해요 ✨' : '새로운 여행을 떠나볼까요 🌍'}
            </p>
        </div>
    );
}
