-- 🌐 커뮤니티(포럼) V2 마이그레이션 스크립트 (Server-Safe)
-- 실행 대상: Supabase SQL Editor
-- 목적: Posts, Comments, Likes 테이블 생성 및 안전한 조회/작성 RLS 정책 적용

--- 1. 커뮤니티 게시글 테이블 (community_posts) ---
CREATE TABLE IF NOT EXISTS public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  category text NOT NULL CHECK (category IN ('qna', 'companion', 'info')),
  title text NOT NULL,
  content text NOT NULL,
  images text[] DEFAULT '{}'::text[],
  
  -- 동행 탭 전용 필드
  companion_date date,
  companion_city text,
  
  -- 연동 기능 (로컬리 체험 상품 ID)
  linked_exp_id bigint REFERENCES public.experiences(id) ON DELETE SET NULL,
  
  -- 통계 및 조회 성능 확보 (디언정규화)
  view_count integer DEFAULT 0,
  like_count integer DEFAULT 0,
  comment_count integer DEFAULT 0,
  
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

--- 2. 커뮤니티 댓글 테이블 (community_comments) ---
CREATE TABLE IF NOT EXISTS public.community_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES public.community_posts(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  is_selected boolean DEFAULT false, -- Q&A 채택 답변 여부
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

--- 3. 커뮤니티 좋아요 테이블 (community_likes) ---
CREATE TABLE IF NOT EXISTS public.community_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES public.community_posts(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(post_id, user_id) -- 한 사람이 여러 번 좋아요 누르는 것 방지
);


--- 4. 검색 폭주 방지를 위한 빠른 인덱스 생성 (서버 부하 감소 핵심) ---
CREATE INDEX IF NOT EXISTS idx_community_posts_category ON public.community_posts (category);
CREATE INDEX IF NOT EXISTS idx_community_posts_created_at ON public.community_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_comments_post_id ON public.community_comments (post_id);
CREATE INDEX IF NOT EXISTS idx_community_likes_post_id ON public.community_likes (post_id);


--- 5. 보안 정책 (Row Level Security - RLS) ---
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_likes ENABLE ROW LEVEL SECURITY;

-- Posts: 누구나(익명 포함) 읽기 가능, 로그인 유저 작성 가능, 작성자 본인만 수정/삭제
CREATE POLICY "Anyone can view community posts" ON public.community_posts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create posts" ON public.community_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own posts" ON public.community_posts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own posts" ON public.community_posts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Comments: 누구나 읽기 가능, 로그인 유저 작성 가능, 작성자 본인만 수정/삭제
CREATE POLICY "Anyone can view comments" ON public.community_comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create comments" ON public.community_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own comments" ON public.community_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own comments" ON public.community_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Likes: 누구나 읽기 가능, 로그인 유저 작성(토글) 및 본인 것 삭제 가능
CREATE POLICY "Anyone can view likes" ON public.community_likes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can like posts" ON public.community_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike posts" ON public.community_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);


--- 6. (부록) 카운트 자동 동기화용 트리거 (선택사항, 프론트에서 관리해도 되나 DB 일관성을 위해 추천) ---
-- 새로운 댓글이 달리면 post의 comment_count +1
CREATE OR REPLACE FUNCTION increment_comment_count() RETURNS trigger AS $$
BEGIN
  UPDATE public.community_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_comment_added
  AFTER INSERT ON public.community_comments
  FOR EACH ROW EXECUTE FUNCTION increment_comment_count();

-- 댓글이 지워지면 post의 comment_count -1
CREATE OR REPLACE FUNCTION decrement_comment_count() RETURNS trigger AS $$
BEGIN
  UPDATE public.community_posts SET comment_count = comment_count - 1 WHERE id = OLD.post_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_comment_removed
  AFTER DELETE ON public.community_comments
  FOR EACH ROW EXECUTE FUNCTION decrement_comment_count();

-- 좋아요 추가 시 count +1
CREATE OR REPLACE FUNCTION increment_like_count() RETURNS trigger AS $$
BEGIN
  UPDATE public.community_posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_like_added
  AFTER INSERT ON public.community_likes
  FOR EACH ROW EXECUTE FUNCTION increment_like_count();

-- 좋아요 취소 시 count -1
CREATE OR REPLACE FUNCTION decrement_like_count() RETURNS trigger AS $$
BEGIN
  UPDATE public.community_posts SET like_count = like_count - 1 WHERE id = OLD.post_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_like_removed
  AFTER DELETE ON public.community_likes
  FOR EACH ROW EXECUTE FUNCTION decrement_like_count();
