-- 1. 보다 완벽하고 안전한 트리거 함수 (Robust Trigger with Exception Handling)
-- 이유: 프론트엔드에서 '19901301' 같은 유효하지 않은 날짜 포맷이나 의도치 않은 빈 문자열이 전달될 경우, 
-- Postgres가 DATE 타입 캐스팅 중 에러를 발생시켜 회원가입 전체(auth.users 생성)를 롤백시키는 치명적 버그가 있습니다.
-- 이를 방지하기 위해 EXCEPTION 블록을 추가하여, 포맷 에러 시 최소한의 기본 정보만이라도 무조건 가입 성공시키도록 보완합니다.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- 시도 1: 모든 부가정보(연락처, 생일, 성별)를 포함하여 완벽하게 Insert 시도
  INSERT INTO public.profiles (id, email, full_name, avatar_url, phone, birth_date, gender)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'User'), 
    NULLIF(NEW.raw_user_meta_data->>'avatar_url', ''),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    (NULLIF(NEW.raw_user_meta_data->>'birth_date', ''))::date,
    NULLIF(NEW.raw_user_meta_data->>'gender', '')
  );
  RETURN NEW;

EXCEPTION WHEN others THEN
  -- 시도 2 (Fallback): 만약 생년월일 포맷 오류(invalid input syntax for type date) 등의 이유로 1번 쿼리가 실패할 경우, 
  -- 회원가입 500 에러를 방지하고 최소한의 필수 정보만이라도 Insert하여 유저 가입을 보장합니다.
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'User'), 
    NULLIF(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
