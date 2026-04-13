interface CommunityAdSlotProps {
    testId: string;
    variant: 'sidebar' | 'bottom';
    title?: string;
}

const VARIANT_CLASSNAME: Record<CommunityAdSlotProps['variant'], string> = {
    sidebar: 'h-64',
    bottom: 'h-24 md:h-28',
};

export default function CommunityAdSlot({
    testId,
    variant,
    title = '광고 영역',
}: CommunityAdSlotProps) {
    return (
        <div
            data-testid={testId}
            className={`flex items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 px-4 text-center shadow-sm ${VARIANT_CLASSNAME[variant]}`}
        >
            <div>
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">
                    Sponsored
                </div>
                <div className="mt-1 text-[12px] font-semibold text-gray-500 md:text-[13px]">
                    {title}
                </div>
            </div>
        </div>
    );
}
