'use client';

import { useEffect } from 'react';
import { createClient } from '@/app/utils/supabase/client';

export default function UserPresenceTracker() {
  const supabase = createClient();

  useEffect(() => {
    const trackPresence = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // 채널 생성 및 입장
      const channel = supabase.channel('online_users');
      
      channel.on('presence', { event: 'sync' }, () => {
        // 접속 상태 동기화됨 (필요시 로직 추가)
      }).subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // 접속 정보 전송
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

    trackPresence();
  }, [supabase]);

  return null; // 화면엔 아무것도 그리지 않음
}