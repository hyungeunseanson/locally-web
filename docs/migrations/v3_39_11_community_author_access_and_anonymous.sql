-- v3.39.11
-- community_posts 익명 작성 플래그를 추가한다.

ALTER TABLE public.community_posts
ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false;
