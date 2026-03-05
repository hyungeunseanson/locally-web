'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';

export default function UserPresenceTracker() {
  const supabase = createClient();
  const pathname = usePathname();
  const lastUpdateRef = useRef<number>(0); // 마지막 업데이트 시간 기록 (메모리)

  // 1. 실시간 채널 (Online 상태 표시용 - 로그인 유저 전용 & 다이나믹 리스너)
  useEffect(() => {
    let channel: any;
    let profileChannel: any;

    const trackPresence = async (user: any) => {
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }

      // 비회원이면 트래킹 안 함
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .maybeSingle();

      const fullName = profile?.full_name || user.user_metadata?.full_name || '이름 없음';
      const avatarUrl = profile?.avatar_url || user.user_metadata?.avatar_url || '';

      channel = supabase.channel('online_users');
      channel.on('presence', { event: 'sync' }, () => { }).subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            email: user.email,
            full_name: fullName,
            avatar_url: avatarUrl,
            connected_at: new Date().toISOString(),
            is_anonymous: false
          });
        }
      });
    };

    // 최초 렌더링 시 현재 세션 확인
    const setupInitialPresence = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      trackPresence(session?.user);

      // 🟢 1-2. DB `profiles` 수정(아바타 등) 감지용 추가 옵저버
      if (session?.user) {
        profileChannel = supabase.channel(`public:profiles:id=eq.${session.user.id}`)
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${session.user.id}`
          }, () => {
            trackPresence(session.user); // 아바타 등이 바뀌면 다시 정보 세팅
          })
          .subscribe();
      }
    };
    setupInitialPresence();

    // 로그인/로그아웃 상태가 바뀔 때 감지하여 트래킹 재시작
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        if (profileChannel) {
          supabase.removeChannel(profileChannel);
          profileChannel = null;
        }

        trackPresence(session?.user);

        // 새 세션이면 다시 profile 감지 등록
        if (event === 'SIGNED_IN' && session?.user) {
          profileChannel = supabase.channel(`public:profiles:id=eq.${session.user.id}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${session.user.id}` }, () => {
              trackPresence(session.user);
            })
            .subscribe();
        }
      }
    });

    return () => {
      if (channel) supabase.removeChannel(channel);
      if (profileChannel) supabase.removeChannel(profileChannel);
      authListener.subscription.unsubscribe();
    };
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