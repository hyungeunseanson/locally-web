'use client';

import React from 'react';
import Image from 'next/image';

export default function ServiceCard({ item }: { item: any }) {
  return (
    <div className="block group cursor-pointer">
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-slate-200 mb-3">
        <Image 
          src={item.image} 
          alt={item.title} 
          fill 
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-6 text-white z-10">
           <h3 className="font-bold text-lg leading-tight mb-1">{item.title}</h3>
           <p className="text-sm opacity-90 line-clamp-2">{item.desc}</p>
        </div>
      </div>
      <div className="mt-1 font-bold text-slate-900 px-1">₩{item.price.toLocaleString()}부터</div>
    </div>
  );
}