-- [커뮤니티 자동화 봇 구축용]
-- 아래 스크립트를 Supabase SQL Editor에서 실행하여 가상 봇 계정을 생성하세요.
-- 실행 후 반환되는 UUID들을 앱 설정 파일(botUsers.ts 또는 API 라우트)에 기입하세요.

-- 1. 날씨 알림이 봇 생성
INSERT INTO auth.users (id, email, raw_user_meta_data, role, aud)
VALUES (
    gen_random_uuid(),
    'bot_weather@locally.co.kr',
    '{"name": "도쿄 날씨봇 ☀️", "avatar_url": "https://api.dicebear.com/7.x/bottts/svg?seed=weather"}',
    'authenticated',
    'authenticated'
);

-- auth.users에 추가되면 trigger에 의해 profiles 테이블에 자동 생성됨
-- 닉네임과 아바타 업데이트
UPDATE public.profiles 
SET 
    name = '도쿄 날씨봇 ☀️',
    avatar_url = 'https://api.dicebear.com/7.x/bottts/svg?seed=weather',
    role = 'user'
WHERE id = (SELECT id FROM auth.users WHERE email = 'bot_weather@locally.co.kr');

-- 2. 맛집 추천 봇 생성
INSERT INTO auth.users (id, email, raw_user_meta_data, role, aud)
VALUES (
    gen_random_uuid(),
    'bot_foodies@locally.co.kr',
    '{"name": "맛집 헌터 🍜", "avatar_url": "https://api.dicebear.com/7.x/bottts/svg?seed=food"}',
    'authenticated',
    'authenticated'
);

UPDATE public.profiles 
SET 
    name = '맛집 헌터 🍜',
    avatar_url = 'https://api.dicebear.com/7.x/bottts/svg?seed=food',
    role = 'user'
WHERE id = (SELECT id FROM auth.users WHERE email = 'bot_foodies@locally.co.kr');

-- 생성된 봇들의 UUID 확인
SELECT id, email, name FROM public.profiles WHERE email IN ('bot_weather@locally.co.kr', 'bot_foodies@locally.co.kr');
