export function NewConversationBadge({ unseen }: { unseen: boolean }) {
  return unseen ? <span aria-label="관리자 미확인 새 메시지" data-testid="admin-conversation-new"
    className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white">N</span> : null;
}
export function AttentionCountBadge({ count, kind = 'unseen' }: { count: number; kind?: 'unseen' | 'action' }) {
  return count > 0 ? <span aria-label={`${kind === 'action' ? '처리 필요' : '미확인'} ${count}건`}
    data-attention-kind={kind} className={`ml-1 inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${kind === 'action' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-700'}`}>
    {kind === 'action' ? '대기 ' : ''}{count}
  </span> : null;
}
