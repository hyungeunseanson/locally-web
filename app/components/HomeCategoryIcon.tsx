'use client';

type HomeCategoryIconProps = {
  id: 'seoul' | 'busan' | 'jeju';
  size?: number;
  className?: string;
};

export default function HomeCategoryIcon({
  id,
  size = 28,
  className,
}: HomeCategoryIconProps) {
  const style = {
    display: 'inline-block',
    verticalAlign: 'middle' as const,
    filter: 'drop-shadow(0px 3px 3px rgba(0,0,0,0.25))',
  };

  if (id === 'seoul') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={style}
        className={className}
      >
        <defs>
          <linearGradient id="home-category-seoul-stone" x1="32" y1="40" x2="32" y2="64" gradientUnits="userSpaceOnUse">
            <stop stopColor="#CFD8DC" />
            <stop offset="1" stopColor="#546E7A" />
          </linearGradient>
          <linearGradient id="home-category-seoul-roof" x1="32" y1="4" x2="32" y2="34" gradientUnits="userSpaceOnUse">
            <stop stopColor="#455A64" />
            <stop offset="1" stopColor="#1C313A" />
          </linearGradient>
          <linearGradient id="home-category-seoul-wood" x1="32" y1="20" x2="32" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor="#D32F2F" />
            <stop offset="1" stopColor="#880E4F" />
          </linearGradient>
        </defs>

        <path d="M 4 40 L 60 40 L 64 64 L 0 64 Z" fill="url(#home-category-seoul-stone)" />
        <path d="M 4 40 L 60 40 L 61 43 L 3 43 Z" fill="#FFFFFF" opacity="0.35" />
        <path d="M 64 64 L 60 40 L 59 40 L 63 64 Z" fill="#FFFFFF" opacity="0.2" />

        <path d="M 22 64 L 22 50 C 22 43, 42 43, 42 50 L 42 64 Z" fill="#111111" />
        <path d="M 20 64 L 20 50 C 20 42, 44 42, 44 50 L 44 64" stroke="#90A4AE" strokeWidth="2.5" fill="none" />

        <rect x="12" y="28" width="40" height="12" fill="url(#home-category-seoul-wood)" />
        <rect x="28" y="28" width="8" height="12" fill="#3E2723" />
        <rect x="16" y="32" width="4" height="8" fill="#3E2723" />
        <rect x="44" y="32" width="4" height="8" fill="#3E2723" />
        <rect x="10" y="25" width="44" height="4" fill="#2E7D32" rx="1" />
        <rect x="10" y="25" width="44" height="1" fill="#A5D6A7" />

        <path d="M 2 26 C 16 14, 48 14, 62 26 C 48 24, 16 24, 2 26 Z" fill="url(#home-category-seoul-roof)" />
        <path d="M 2 26 C 16 14, 48 14, 62 26" stroke="#90A4AE" strokeWidth="1.5" fill="none" />

        <rect x="20" y="14" width="24" height="10" fill="url(#home-category-seoul-wood)" />
        <rect x="18" y="11" width="28" height="4" fill="#2E7D32" rx="1" />
        <rect x="18" y="11" width="28" height="1" fill="#A5D6A7" />
        <rect x="28" y="14" width="8" height="4" fill="#1B5E20" rx="0.5" />
        <rect x="28" y="14" width="8" height="1" fill="#FFCA28" opacity="0.8" />

        <path d="M 6 14 C 20 2, 44 2, 58 14 C 44 11, 20 11, 6 14 Z" fill="url(#home-category-seoul-roof)" />
        <path d="M 6 14 C 20 2, 44 2, 58 14" stroke="#90A4AE" strokeWidth="2" fill="none" />

        <path d="M 20 4 Q 32 6 44 4" stroke="#CFD8DC" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </svg>
    );
  }

  if (id === 'busan') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={style}
        className={className}
      >
        <defs>
          <linearGradient id="home-category-busan-bridge" x1="32" y1="4" x2="32" y2="60" gradientUnits="userSpaceOnUse">
            <stop stopColor="#F44336" />
            <stop offset="1" stopColor="#B71C1C" />
          </linearGradient>
          <linearGradient id="home-category-busan-cable" x1="0" y1="0" x2="64" y2="0" gradientUnits="userSpaceOnUse">
            <stop stopColor="#EF5350" />
            <stop offset="0.5" stopColor="#FFCDD2" />
            <stop offset="1" stopColor="#EF5350" />
          </linearGradient>
        </defs>

        <path d="M 0 46 L 64 46 L 64 54 L 0 54 Z" fill="url(#home-category-busan-bridge)" />
        <path d="M 0 46 L 64 46 L 64 48 L 0 48 Z" fill="#FFCDD2" opacity="0.8" />
        <path d="M 0 52 L 64 52 L 64 54 L 0 54 Z" fill="#7F0000" opacity="0.8" />

        <path d="M 14 6 L 22 6 L 24 64 L 12 64 Z" fill="url(#home-category-busan-bridge)" />
        <path d="M 14 6 L 16 6 L 17 64 L 12 64 Z" fill="#FFCDD2" opacity="0.4" />
        <path d="M 20 6 L 22 6 L 24 64 L 22 64 Z" fill="#7F0000" opacity="0.6" />
        <rect x="13.5" y="24" width="9" height="5" fill="#7F0000" />
        <rect x="14.5" y="38" width="8.5" height="5" fill="#7F0000" />

        <path d="M 42 6 L 50 6 L 52 64 L 40 64 Z" fill="url(#home-category-busan-bridge)" />
        <path d="M 42 6 L 44 6 L 45 64 L 40 64 Z" fill="#FFCDD2" opacity="0.4" />
        <path d="M 48 6 L 50 6 L 52 64 L 50 64 Z" fill="#7F0000" opacity="0.6" />
        <rect x="41.5" y="24" width="9" height="5" fill="#7F0000" />
        <rect x="41" y="38" width="8.5" height="5" fill="#7F0000" />

        <path d="M -8 18 Q 32 46 72 18" stroke="url(#home-category-busan-cable)" strokeWidth="4.5" fill="none" strokeLinecap="round" />
        <path d="M -8 18 Q 32 46 72 18" stroke="#FFFFFF" strokeWidth="1.5" fill="none" opacity="0.6" />

        <line x1="6" y1="28" x2="6" y2="46" stroke="#EF5350" strokeWidth="2" />
        <line x1="32" y1="44" x2="32" y2="46" stroke="#EF5350" strokeWidth="2" />
        <line x1="58" y1="28" x2="58" y2="46" stroke="#EF5350" strokeWidth="2" />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
      className={className}
    >
      <defs>
        <linearGradient id="home-category-jeju-body" x1="16" y1="4" x2="48" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#90A4AE" />
          <stop offset="1" stopColor="#263238" />
        </linearGradient>
        <linearGradient id="home-category-jeju-rim" x1="16" y1="4" x2="48" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#CFD8DC" />
          <stop offset="1" stopColor="#546E7A" stopOpacity="0" />
        </linearGradient>
      </defs>

      <path d="M 22 16 C 22 2, 42 2, 42 16 L 48 62 C 48 64, 16 64, 16 62 Z" fill="url(#home-category-jeju-body)" />
      <path d="M 22 16 C 22 2, 42 2, 42 16 L 48 62" stroke="url(#home-category-jeju-rim)" strokeWidth="2.5" fill="none" opacity="0.8" />

      <path d="M 18 18 C 18 6, 46 6, 46 18 C 46 22, 18 22, 18 18 Z" fill="#37474F" />
      <path d="M 18 18 C 18 12, 46 12, 46 18" fill="#546E7A" />

      <ellipse cx="26" cy="28" rx="4.5" ry="4.5" fill="#111111" />
      <ellipse cx="38" cy="28" rx="4.5" ry="4.5" fill="#111111" />
      <ellipse cx="27" cy="27" rx="1.5" ry="1" fill="#FFFFFF" opacity="0.15" transform="rotate(-30 27 27)" />

      <rect x="29" y="30" width="6" height="12" rx="3" fill="#455A64" />
      <path d="M 29 42 L 35 42 L 35 44 L 29 44 Z" fill="#111111" opacity="0.7" />

      <path d="M 24 48 Q 32 50 40 48" stroke="#111111" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.8" />

      <path d="M 16 54 Q 32 48 48 54" stroke="#455A64" strokeWidth="8" fill="none" strokeLinecap="round" />
      <path d="M 16 54 Q 32 48 48 54" stroke="#78909C" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.5" transform="translate(0,-2)" />
    </svg>
  );
}
