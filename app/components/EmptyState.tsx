'use client';

import { useRouter } from 'next/navigation';
import { PackageOpen } from 'lucide-react'; // 아이콘 변경 가능

interface EmptyStateProps {
  title?: string;
  subtitle?: string;
  showReset?: boolean;
  actionLabel?: string;
  actionUrl?: string;
}

export default function EmptyState({
  title = "표시할 내용이 없어요",
  subtitle = "조건을 바꿔보거나 다른 메뉴를 둘러보세요.",
  showReset,
  actionLabel,
  actionUrl
}: EmptyStateProps) {
  const router = useRouter();

  return (
    <div className="h-[60vh] flex flex-col gap-2 justify-center items-center">
      <div className="bg-slate-100 p-4 rounded-full mb-2">
        <PackageOpen size={48} className="text-slate-400" />
      </div>
      <div className="text-center">
        <div className="text-lg font-bold text-slate-900">
          {title}
        </div>
        <div className="font-light text-slate-500 mt-1">
          {subtitle}
        </div>
      </div>
      {actionLabel && actionUrl && (
        <div className="mt-4">
          <button
            onClick={() => router.push(actionUrl)}
            className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-md"
          >
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}