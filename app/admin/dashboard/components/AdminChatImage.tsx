'use client';

import Image from 'next/image';
import { useState } from 'react';

/** The API supplies an authenticated delivery URL, never a storage object key. */
export default function AdminChatImage({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return <div className="max-w-full">
    {failed ? <div role="status" className="space-y-2">
      <p>이미지를 불러오지 못했습니다.</p>
      <button className="underline" onClick={() => { setFailed(false); setAttempt(value => value + 1); }}>이미지 다시 시도</button>
    </div> : <a href={src} target="_blank" rel="noopener noreferrer" aria-label="첨부 이미지 새 창에서 보기">
      <Image key={attempt} src={src} alt="대화 첨부 이미지" width={360} height={360} unoptimized
        className="h-auto max-h-80 max-w-full rounded object-contain" onError={() => setFailed(true)} />
    </a>}
  </div>;
}
