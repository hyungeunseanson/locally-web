// app/utils/api/experiences.ts
import { createClient } from '../supabase/client';
import { Experience } from '../../types';

export const fetchActiveExperiences = async (): Promise<Experience[]> => {
  const supabase = createClient();
  
  // 1. 활성 상태인 체험 기본 정보 가져오기
  const { data: expData, error } = await supabase
    .from('experiences')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) throw new Error('체험 데이터를 불러오는 데 실패했습니다.');
  if (!expData || expData.length === 0) return [];

  // 2. 해당 체험들의 예약 가능 날짜(availability) 한 번에 가져오기
  const expIds = expData.map((e: any) => e.id);
  const { data: dateData } = await supabase
    .from('experience_availability')
    .select('experience_id, date')
    .in('experience_id', expIds);

  // 3. 두 데이터 병합하여 리턴
  const mergedData = expData.map((exp: any) => ({
    ...exp,
    available_dates: dateData
      ?.filter((d: any) => d.experience_id === exp.id)
      .map((d: any) => d.date) || [],
  }));

  return mergedData;
};