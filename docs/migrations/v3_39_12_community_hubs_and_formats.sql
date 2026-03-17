-- v3.39.12
-- community_posts 에 도시 허브 / 포맷 / 원문 언어 필드를 추가한다.

ALTER TABLE public.community_posts
ADD COLUMN IF NOT EXISTS post_format text NOT NULL DEFAULT 'question';

ALTER TABLE public.community_posts
ADD COLUMN IF NOT EXISTS destination_hub text;

ALTER TABLE public.community_posts
ADD COLUMN IF NOT EXISTS source_locale text NOT NULL DEFAULT 'ko';

UPDATE public.community_posts
SET
  post_format = CASE
    WHEN category = 'companion' THEN 'companion'
    WHEN category = 'info' THEN 'live_tip'
    WHEN category = 'locally_content' THEN 'locally_pick'
    ELSE 'question'
  END
WHERE post_format IS NULL
   OR post_format NOT IN ('question', 'companion', 'live_tip', 'locally_pick');

ALTER TABLE public.community_posts
DROP CONSTRAINT IF EXISTS community_posts_post_format_check;

ALTER TABLE public.community_posts
ADD CONSTRAINT community_posts_post_format_check
CHECK (post_format IN ('question', 'companion', 'live_tip', 'locally_pick'));

ALTER TABLE public.community_posts
DROP CONSTRAINT IF EXISTS community_posts_destination_hub_check;

ALTER TABLE public.community_posts
ADD CONSTRAINT community_posts_destination_hub_check
CHECK (
  destination_hub IS NULL
  OR destination_hub IN ('tokyo', 'osaka_kyoto', 'fukuoka', 'jp_other', 'seoul', 'busan', 'jeju')
);

ALTER TABLE public.community_posts
DROP CONSTRAINT IF EXISTS community_posts_source_locale_check;

ALTER TABLE public.community_posts
ADD CONSTRAINT community_posts_source_locale_check
CHECK (source_locale IN ('ko', 'ja', 'en', 'zh'));

CREATE INDEX IF NOT EXISTS idx_community_posts_destination_hub
ON public.community_posts (destination_hub);

CREATE INDEX IF NOT EXISTS idx_community_posts_post_format
ON public.community_posts (post_format);
