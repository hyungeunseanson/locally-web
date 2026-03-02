'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';

export default function UserPresenceTracker() {
  const supabase = createClient();
  const pathname = usePathname();
  const lastUpdateRef = useRef<number>(0); // 마지막 업데이트 시간 기록 (메모리)

  // 1. 실시간 채널 (Online 상태 표시용 - 1회 마운트 연결)
  useEffect(() => {
    const trackChannel = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      const channel = supabase.channel('online_users');
      channel.on('presence', { event: 'sync' }, () => { }).subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user?.id || 'guest',
            email: user?.email || '비회원',
            connected_at: new Date().toISOString(),
            is_anonymous: !user
          });
        }
      });

      return () => {
        supabase.removeChannel(channel);
      };
    };

    trackChannel();
  }, [supabase]);

  // 2. DB 업데이트 (최근 접속 기록용 - 라우팅마다 검사하되 5분 쿨타임 적용)
  useEffect(() => {
    const trackActivity = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const now = Date.now();
        const THROTTLE_MS = 5 * 60 * 1000; // 5분 간격 제한 (DB 부하 방지)

        // 로컬 스토리지도 체크 (새로고침해도 쿨타임 유지)
        const storedLastUpdate = localStorage.getItem('last_active_update');
        const lastTime = storedLastUpdate ? parseInt(storedLastUpdate) : 0;

        if (now - lastTime > THROTTLE_MS) {
          await supabase
            .from('profiles')
            .update({ last_active_at: new Date().toISOString() })
            .eq('id', user.id);

          localStorage.setItem('last_active_update', now.toString());
          lastUpdateRef.current = now;
        }
      }
    };

    trackActivity();
  }, [supabase, pathname]);

  return null;
}