-- v3.39.08
-- community_posts.category CHECK 제약에 'locally_content'를 추가한다.

ALTER TABLE public.community_posts
DROP CONSTRAINT IF EXISTS community_posts_category_check;

ALTER TABLE public.community_posts
ADD CONSTRAINT community_posts_category_check
CHECK (category IN ('qna', 'companion', 'info', 'locally_content'));
