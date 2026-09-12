import { MetadataRoute } from 'next';
import { createAdminClient } from '@/app/utils/supabase/admin';
import {
  isPublicHostApplicationStatus,
  pickLatestPublicHostApplicationsByUser,
} from '@/app/utils/hostVisibility';
import { buildAbsoluteUrl } from '@/app/utils/siteUrl';
import { isMissingCommunityBoardColumnError } from '@/app/community/anonymousColumn';
import { inferCommunityBoardFromLegacyHub } from '@/app/community/boardMeta';

// 1시간 캐시: 매 크롤러 요청마다 DB 조회하지 않도록
export const revalidate = 3600;

type StaticRouteConfig = {
  pathname: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>;
  priority: number;
};

const STATIC_ROUTE_CONFIGS: StaticRouteConfig[] = [
  {
    pathname: '/',
    changeFrequency: 'daily',
    priority: 1,
  },
  {
    pathname: '/about',
    changeFrequency: 'monthly',
    priority: 0.8,
  },
  {
    pathname: '/become-a-host',
    changeFrequency: 'weekly',
    priority: 0.9,
  },
  {
    pathname: '/help',
    changeFrequency: 'weekly',
    priority: 0.7,
  },
  {
    pathname: '/search',
    changeFrequency: 'daily',
    priority: 0.9,
  },
  {
    pathname: '/community',
    changeFrequency: 'daily',
    priority: 0.8,
  },
  {
    pathname: '/services/intro',
    changeFrequency: 'weekly',
    priority: 0.8,
  },
  {
    pathname: '/proxy-bookings/new',
    changeFrequency: 'weekly',
    priority: 0.7,
  },
  {
    pathname: '/site-map',
    changeFrequency: 'monthly',
    priority: 0.5,
  },
  {
    pathname: '/privacy',
    changeFrequency: 'yearly',
    priority: 0.4,
  },
  {
    pathname: '/company/notices',
    changeFrequency: 'daily',
    priority: 0.8,
  },
  {
    pathname: '/company/news',
    changeFrequency: 'daily',
    priority: 0.8,
  },
  {
    pathname: '/company/careers',
    changeFrequency: 'monthly',
    priority: 0.6,
  },
  {
    pathname: '/company/investors',
    changeFrequency: 'monthly',
    priority: 0.5,
  },
  {
    pathname: '/company/partnership',
    changeFrequency: 'monthly',
    priority: 0.5,
  },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticUrls: MetadataRoute.Sitemap = STATIC_ROUTE_CONFIGS.map((routeConfig) => ({
    url: buildAbsoluteUrl(routeConfig.pathname),
    changeFrequency: routeConfig.changeFrequency,
    priority: routeConfig.priority,
  }));

  // 동적 체험 URL — Supabase에서 active 체험 조회
  try {
    const supabase = createAdminClient();

    const [{ data: experiences }, communityPostsResult, { data: publicHosts }] = await Promise.all([
      supabase
        .from('experiences')
        .select('id, host_id, updated_at, is_active')
        .eq('status', 'active'),
      supabase
        .from('community_posts')
        .select('id, category, board_country, destination_hub, created_at, updated_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('public_host_applications')
        .select('id, user_id, status, created_at')
        .order('created_at', { ascending: false }),
    ]);

    let communityPosts = communityPostsResult.data ?? [];
    if (communityPostsResult.error && isMissingCommunityBoardColumnError(communityPostsResult.error)) {
      const fallbackResult = await supabase
        .from('community_posts')
        .select('id, category, destination_hub, created_at, updated_at')
        .order('created_at', { ascending: false });
      communityPosts = (fallbackResult.data ?? []).map((post) => ({
        ...post,
        board_country: null,
      }));
    }

    const latestPublicHosts = Array.from(
      pickLatestPublicHostApplicationsByUser(publicHosts || []).values()
    );
    const publicHostIds = new Set(
      latestPublicHosts
        .filter((host) => host.user_id && isPublicHostApplicationStatus(host.status))
        .map((host) => String(host.user_id))
    );

    const experienceUrls: MetadataRoute.Sitemap = (experiences || [])
      .filter((exp) => exp.is_active !== false && exp.host_id && publicHostIds.has(String(exp.host_id)))
      .map((exp) => ({
        url: buildAbsoluteUrl(`/experiences/${exp.id}`),
        lastModified: exp.updated_at ? new Date(exp.updated_at) : new Date(),
        changeFrequency: 'weekly',
        priority: 0.9,
      }));

    const communityUrls: MetadataRoute.Sitemap = (communityPosts || [])
      .filter((post) => {
        const inferredBoard = post.board_country ?? inferCommunityBoardFromLegacyHub(post.destination_hub);
        return post.category === 'locally_content' || inferredBoard === 'japan' || inferredBoard === 'korea';
      })
      .map((post) => ({
        url: buildAbsoluteUrl(`/community/${post.id}`),
        lastModified: new Date(post.updated_at || post.created_at || new Date()),
        changeFrequency: 'weekly',
        priority: 0.7,
      }));

    const publicHostUrls: MetadataRoute.Sitemap = latestPublicHosts
      .filter((host) => host.user_id && isPublicHostApplicationStatus(host.status))
      .map((host) => ({
        url: buildAbsoluteUrl(`/users/${host.user_id}`),
        lastModified: host.created_at ? new Date(host.created_at) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }));

    return [...staticUrls, ...experienceUrls, ...communityUrls, ...publicHostUrls];
  } catch {
    // Supabase 조회 실패 시 정적 URL만 반환 (graceful fallback)
    return staticUrls;
  }
}
