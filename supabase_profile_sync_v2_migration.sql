-- 1. 새로운 트리거 함수로 교체 (휴대폰, 생년월일, 성별 추가 및 컬럼명 full_name 통일)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, phone, birth_date, gender)
  VALUES (
    NEW.id, 
    NEW.email, 
    -- 기존 raw_user_meta_data 에 들어온 값들을 정확한 컬럼에 매핑
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'User'), 
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'birth_date',
    NEW.raw_user_meta_data->>'gender'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- (트리거 부착은 이미 on_auth_user_created 로 되어 있으므로 함수 본문만 REPLACE 하면 즉시 적용됩니다.)
