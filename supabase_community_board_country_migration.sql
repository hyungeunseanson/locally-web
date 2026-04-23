ALTER TABLE public.community_posts
ADD COLUMN IF NOT EXISTS board_country text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'community_posts_board_country_check'
  ) THEN
    ALTER TABLE public.community_posts
      ADD CONSTRAINT community_posts_board_country_check
      CHECK (board_country IS NULL OR board_country IN ('japan', 'korea'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_community_posts_board_country_created_at
  ON public.community_posts (board_country, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_community_posts_board_country_popular
  ON public.community_posts (board_country, like_count DESC, comment_count DESC, created_at DESC);

