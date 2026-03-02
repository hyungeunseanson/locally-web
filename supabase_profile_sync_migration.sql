-- 1. [Backfill] 고스트 유저 복구 (DB 록인 해제)
-- 현재 auth.users에는 가입되어 있으나 public.profiles에는 존재하지 않는 유저들을 구출하기 위함.
INSERT INTO public.profiles (id, email)
SELECT id, email
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles);

-- 2. 새롭게 가입하는 유저를 위한 트리거 함수 정의
-- auth.users 에 Insert가 발생하면 public.profiles 레코드를 생성하여 완벽한 원자성을 보장.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar_url)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'User'), 
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 이전에 정의되었을 수도 있는 동일 이름의 트리거 제거 후 안전 부착
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
