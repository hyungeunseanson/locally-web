'use client';

import React from 'react';
import Image from 'next/image';
import { Star } from 'lucide-react';
import { useLanguage } from '@/app/context/LanguageContext';

type LocallyService = {
  id: number;
  title: string;
  price: number;
  image: string;
  desc: string;
};

export default function ServiceCard({ item }: { item: LocallyService }) {
  const { t } = useLanguage();

  return (
    <div className="block group cursor-pointer active:scale-[0.98] transition-transform duration-200">
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-slate-200 mb-2 md:mb-3 border border-transparent [box-shadow:var(--shadow-card)] group-hover:[box-shadow:var(--shadow-card-hover)] group-hover:-translate-y-1 transition-all duration-500 ease-out">
        <Image
          src={item.image}
          alt={item.title}
          fill
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
        />
      </div>

      <div className="space-y-0.5 md:space-y-1 px-0.5 md:px-1">
        <div className="flex justify-between items-start">
          <h3 className="font-bold text-slate-900 text-[12px] md:text-[15px] truncate pr-2 tracking-tight">
            {t('footer_locally')} · {t('cat_service')}
          </h3>
          <div className="flex items-center gap-0.5 md:gap-1 text-[11px] md:text-sm shrink-0">
            <Star size={11} className="md:w-[14px] md:h-[14px]" />
            <span>New</span>
          </div>
        </div>

        <p className="text-[11px] md:text-[15px] text-slate-500 line-clamp-1 leading-snug tracking-tight">
          {item.title}
        </p>

        <div className="mt-0.5 md:mt-1">
          <span className="text-[11px] md:text-[14px] text-slate-500 font-normal">{t('cat_service')} </span>
          <span className="font-black text-slate-900 text-[12px] md:text-[15px] tracking-tight">
            ₩{item.price.toLocaleString()}부터
          </span>
        </div>
      </div>
    </div>
  );
}
