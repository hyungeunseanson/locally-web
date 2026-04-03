// app/utils/api/experiences.ts
import { createClient } from '../supabase/client';
import { Experience } from '../../types';
import {
  isPublicHostApplicationStatus,
  pickLatestPublicHostApplicationsByUser,
} from '../hostVisibility';

export const fetchActiveExperiences = async (): Promise<Experience[]> => {
  const supabase = createClient();

  // 1. 공개 상태 호스트 목록 조회 (안전한 필터링)
  const { data: publicHostApplications, error: appError } = await supabase
    .from('public_host_applications')
    .select('id, user_id, status, created_at');

  if (appError) console.error('Failed to fetch host applications status:', appError);

  const visibleHostIds = Array.from(
    pickLatestPublicHostApplicationsByUser(publicHostApplications || [])
      .values()
  )
    .filter((row) => isPublicHostApplicationStatus(row.status))
    .map((row) => row.user_id)
    .filter((value): value is string => typeof value === 'string' && value.length > 0);

  if (visibleHostIds.length === 0) return []; // 공개 상태 호스트가 없으면 빈 배열 반환

  // 2. 활성 상태이고 호스트가 공개 상태인 체험 기본 정보 가져오기
  const { data: expData, error } = await supabase
    .from('experiences')
    .select('*')
    .eq('status', 'active')
    .in('host_id', visibleHostIds)
    .order('created_at', { ascending: false });

  if (error) throw new Error('체험 데이터를 불러오는 데 실패했습니다.');
  if (!expData || expData.length === 0) return [];

  // 3. 해당 체험들의 예약 가능 날짜(availability) 한 번에 가져오기
  const expIds = expData.map((e: any) => e.id);
  const { data: dateData } = await supabase
    .from('experience_availability')
    .select('experience_id, date')
    .in('experience_id', expIds);

  // 4. 두 데이터 병합하여 리턴
  const mergedData = expData.map((exp: any) => ({
    ...exp,
    available_dates: dateData
      ?.filter((d: any) => d.experience_id === exp.id)
      .map((d: any) => d.date) || [],
  }));

  return mergedData;
};
