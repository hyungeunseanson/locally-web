BEGIN;

ALTER TABLE public.community_comments
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.community_comments(id) ON DELETE CASCADE;

ALTER TABLE public.community_comments
  ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'community_comments'
      AND column_name = 'is_selected'
  ) THEN
    ALTER TABLE public.community_comments DROP COLUMN is_selected;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.community_comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid REFERENCES public.community_comments(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_community_comments_parent_id ON public.community_comments (parent_id);
CREATE INDEX IF NOT EXISTS idx_community_comment_likes_comment_id ON public.community_comment_likes (comment_id);

ALTER TABLE public.community_comment_likes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'community_comment_likes'
      AND policyname = 'Anyone can view comment likes'
  ) THEN
    CREATE POLICY "Anyone can view comment likes"
      ON public.community_comment_likes
      FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'community_comment_likes'
      AND policyname = 'Authenticated users can like comments'
  ) THEN
    CREATE POLICY "Authenticated users can like comments"
      ON public.community_comment_likes
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'community_comment_likes'
      AND policyname = 'Users can unlike comments'
  ) THEN
    CREATE POLICY "Users can unlike comments"
      ON public.community_comment_likes
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.increment_comment_like_count() RETURNS trigger AS $$
BEGIN
  UPDATE public.community_comments
  SET like_count = like_count + 1
  WHERE id = NEW.comment_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.decrement_comment_like_count() RETURNS trigger AS $$
BEGIN
  UPDATE public.community_comments
  SET like_count = GREATEST(like_count - 1, 0)
  WHERE id = OLD.comment_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_comment_like_added ON public.community_comment_likes;
CREATE TRIGGER on_comment_like_added
  AFTER INSERT ON public.community_comment_likes
  FOR EACH ROW EXECUTE FUNCTION public.increment_comment_like_count();

DROP TRIGGER IF EXISTS on_comment_like_removed ON public.community_comment_likes;
CREATE TRIGGER on_comment_like_removed
  AFTER DELETE ON public.community_comment_likes
  FOR EACH ROW EXECUTE FUNCTION public.decrement_comment_like_count();

UPDATE public.community_comments AS comments
SET like_count = likes.like_count
FROM (
  SELECT comment_id, COUNT(*)::integer AS like_count
  FROM public.community_comment_likes
  GROUP BY comment_id
) AS likes
WHERE comments.id = likes.comment_id;

UPDATE public.community_comments
SET like_count = 0
WHERE like_count IS NULL;

COMMIT;
