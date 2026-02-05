'use client';

import React from 'react';

export default function ServiceCard({ item }: { item: any }) {
  return (
    <div className="block group cursor-pointer">
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-slate-200 mb-3">
        <img src={item.image} alt={item.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"/>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-6 text-white">
           <h3 className="font-bold text-lg leading-tight mb-1">{item.title}</h3>
           <p className="text-sm opacity-90 line-clamp-2">{item.desc}</p>
        </div>
      </div>
      <div className="mt-1 font-bold text-slate-900 px-1">₩{item.price.toLocaleString()}부터</div>
    </div>
  );
}