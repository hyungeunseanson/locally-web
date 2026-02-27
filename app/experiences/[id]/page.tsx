import { Metadata } from 'next';
import { createClient } from '@/app/utils/supabase/server';
import ExperienceClient from './ExperienceClient';
import { notFound } from 'next/navigation';
import { getCurrentLocale } from '@/app/utils/locale';
import { getContent } from '@/app/utils/contentHelper';
import { ExperienceDetail, HostProfileDetail } from './types';
import { BOOKING_ACTIVE_STATUS_FOR_CAPACITY } from '@/app/constants/bookingStatus';

type Props = {
  params: Promise<{ id: string }>;
}

// 🟢 메타데이터 생성 (SEO & 다국어)
export async function generateMetadata(
  { params }: Props
): Promise<Metadata> {
  const { id } = await params;
  const locale = await getCurrentLocale(); // 현재 언어 감지
  const supabase = await createClient();

  // 모든 다국어 컬럼 조회
  const { data: experience } = await supabase
    .from('experiences')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!experience) {
    return {
      title: '체험을 찾을 수 없습니다 - Locally',
    }
  }

  // 언어에 맞는 제목과 설명 가져오기
  const title = getContent(experience, 'title', locale);
  const description = getContent(experience, 'description', locale);
  const imageUrl = experience.photos?.[0] || experience.image_url || 'https://images.unsplash.com/photo-1540206395-688085723adb';

  return {
    title: `${title} - Locally`,
    description: description?.slice(0, 150) || '현지인과 함께하는 특별한 여행',
    openGraph: {
      title: title,
      description: description?.slice(0, 150),
      images: [imageUrl],
      locale: locale,
      siteName: 'Locally',
    },
    twitter: {
      card: 'summary_large_image',
      title: title,
      description: description?.slice(0, 150),
      images: [imageUrl],
    },
    alternates: {
      canonical: `https://locally.vercel.app/experiences/${id}`,
      languages: {
        'ko': `https://locally.vercel.app/experiences/${id}`,
        'en': `https://locally.vercel.app/en/experiences/${id}`,
        'ja': `https://locally.vercel.app/ja/experiences/${id}`,
        'zh': `https://locally.vercel.app/zh/experiences/${id}`,
      },
    }
  }
}

// 🟢 메인 페이지 컴포넌트 (Server Side Rendering)
export default async function Page({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  // 1. 병렬 데이터 페칭 (속도 최적화)
  const [expResult, datesResult, bookingsResult, userResult] = await Promise.all([
    supabase.from('experiences').select('*').eq('id', id).maybeSingle(),
    supabase.from('experience_availability').select('date, start_time').eq('experience_id', id).eq('is_booked', false),
    supabase
      .from('bookings')
      .select('date, time, guests')
      .eq('experience_id', id)
      .in('status', [...BOOKING_ACTIVE_STATUS_FOR_CAPACITY]),
    supabase.auth.getUser()
  ]);

  const experience = expResult.data as ExperienceDetail | null;

  if (!experience) {
    return notFound();
  }

  // 2. 호스트 프로필 데이터 가져오기
  let hostProfile: HostProfileDetail = null;
  if (experience.host_id) {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', experience.host_id).maybeSingle();
    const { data: app } = await supabase.from('host_applications').select('*').eq('user_id', experience.host_id).limit(1).maybeSingle();
    
    const joinedYear = profile?.created_at
      ? Math.max(1, new Date().getFullYear() - new Date(profile.created_at).getFullYear())
      : null;

    hostProfile = {
      id: experience.host_id,
      name: app?.name || profile?.name || profile?.full_name || 'Locally Host',
      avatar_url: app?.profile_photo || profile?.avatar_url || null,
      languages: (profile?.languages?.length > 0) ? profile.languages : (app?.languages || []),
      introduction: profile?.introduction || profile?.bio || app?.self_intro || '안녕하세요! 로컬리 호스트입니다.',
      job: profile?.job,
      dream_destination: profile?.dream_destination,
      favorite_song: profile?.favorite_song,
      joined_year: joinedYear,
    };
  }

  // 3. 예약 가능 날짜 및 잔여석 계산 로직
  const availableDates: string[] = [];
  const dateToTimeMap: Record<string, string[]> = {};
  const remainingSeatsMap: Record<string, number> = {};
  const maxGuests = Number(experience.max_guests || 10);

  if (datesResult.data) {
    const availabilityRows = datesResult.data as Array<{ date: string; start_time: string }>;
    const bookingRows = (bookingsResult.data || []) as Array<{ date: string; time: string; guests: number | null }>;

    availabilityRows.forEach((d) => {
      const availTime = String(d.start_time).substring(0, 5);
      
      const currentBooked = bookingRows
        .filter((b) => {
          const bookingTime = String(b.time).substring(0, 5);
          return b.date === d.date && bookingTime === availTime;
        })
        .reduce((sum: number, b) => sum + Number(b.guests || 0), 0);

      const remaining = maxGuests - currentBooked;
      const key = `${d.date}_${availTime}`;

      if (remaining > 0) {
        if (!dateToTimeMap[d.date]) dateToTimeMap[d.date] = [];
        if (!dateToTimeMap[d.date].includes(availTime)) {
          dateToTimeMap[d.date].push(availTime);
        }
        remainingSeatsMap[key] = remaining;
      }
    });
    
    Object.keys(dateToTimeMap).sort().forEach(date => availableDates.push(date));
  }

  // 4. Client Component로 데이터 전달
  return (
    <ExperienceClient 
      initialUser={userResult.data.user}
      initialExperience={experience}
      initialHostProfile={hostProfile}
      initialAvailableDates={availableDates}
      initialDateToTimeMap={dateToTimeMap}
      initialRemainingSeatsMap={remainingSeatsMap}
    />
  );
}
