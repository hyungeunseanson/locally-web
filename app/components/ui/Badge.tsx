// app/components/ui/Badge.tsx
import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'primary' | 'blue' | 'gray';
}

export const Badge = ({ children, variant = 'primary', className = '', ...props }: BadgeProps) => {
  const baseStyle = "text-[10px] font-bold px-1.5 py-[2px] rounded-full shadow-sm tracking-wide border border-white z-10";
  
  const variants = {
    primary: "bg-[#FF385C] text-white", // 빨강
    blue: "bg-[#0066CC] text-white",    // 파랑 (우리 카테고리에 적용했던 색)
    gray: "bg-slate-200 text-slate-700",
  };

  return (
    <div className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>
      {children}
    </div>
  );
};