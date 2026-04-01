// app/components/ui/Button.tsx
import React, { ButtonHTMLAttributes } from 'react';
import Spinner, { type SpinnerVariant } from './Spinner';

// 디자인 변형(Variant)과 크기(Size)를 타입으로 정의
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'tab';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  interaction?: 'default' | 'app';
  loadingLabel?: string;
  spinnerVariant?: SpinnerVariant;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = '',
      variant = 'primary',
      size = 'md',
      isLoading,
      interaction = 'default',
      loadingLabel,
      spinnerVariant = 'inverse',
      children,
      disabled,
      ['aria-busy']: ariaBusyProp,
      ...props
    },
    ref
  ) => {
    // 🟢 1. 기본 스타일 (모든 버튼 공통)
    const baseStyle = "inline-flex items-center justify-center font-bold rounded-xl transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap";

    // 🟢 2. 변형(Variant) 스타일 매핑 (기존 하드코딩된 색상들)
    const variants = {
      primary: "bg-[#FF385C] text-white hover:bg-[#D70466]", // 에어비앤비 코어 컬러
      secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
      outline: "border border-slate-300 text-slate-700 hover:border-slate-900 hover:bg-slate-50",
      ghost: "text-slate-700 hover:bg-slate-100",
      tab: "rounded-full hover:bg-slate-50/80", // 우리가 방금 만든 카테고리 탭 전용
    };

    // 🟢 3. 크기(Size) 매핑
    const sizes = {
      sm: "px-3 py-1.5 text-sm",
      md: "px-6 py-3 text-base",
      lg: "px-8 py-4 text-lg",
      icon: "p-2",
    };

    const interactions = {
      default: "active:scale-95 disabled:active:scale-100",
      app: "shadow-md shadow-slate-200/70 hover:-translate-y-[1px] hover:shadow-lg active:shadow-sm active:brightness-95 disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:active:brightness-100",
    };
    const resolvedAriaBusy = ariaBusyProp != null
      ? String(ariaBusyProp)
      : (isLoading ? 'true' : 'false');

    // 조합
    const combinedClassName = `${baseStyle} ${variants[variant]} ${sizes[size]} ${interactions[interaction]} ${className}`;

    return (
      <button
        ref={ref}
        {...props}
        disabled={disabled || isLoading}
        aria-busy={resolvedAriaBusy}
        className={combinedClassName}
      >
        {isLoading ? (
          <>
            <Spinner
              inline
              size={18}
              variant={spinnerVariant}
              ariaHidden
              className="mr-2"
            />
            <span>{loadingLabel ?? children}</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
