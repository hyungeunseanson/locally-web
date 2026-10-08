import { MetadataRoute } from 'next';
import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/app/utils/supabase/admin';
import {
  isPublicHostApplicationStatus,
  isPublicExperienceVisible,
  pickLatestPublicHostApplicationsByUser,
} from '@/app/utils/hostVisibility';
import { buildAbsoluteUrl } from '@/app/utils/siteUrl';
import { isCommunityPostIndexable } from '@/app/community/indexability';
import { createPublicServerClient } from '@/app/utils/supabase/public-server';
import { readSitemapData, SitemapDataError } from '@/app/utils/sitemapData';

// Generate at request time so builds do not require a live Production database.
export const dynamic = 'force-dynamic';
// Only complete successful datasets are cached; failed refreshes cannot replace them.
const getSitemapData = unstable_cache(
  async () => {
    try {
      return await readSitemapData(createAdminClient(), createPublicServerClient());
    } catch (error) {
      console.error('[Sitemap] Generation failed', error instanceof SitemapDataError
        ? { source: error.source, code: error.code }
        : { code: 'GENERATION_FAILED' });
      // This also logs failed background refreshes without exposing database details.
      throw error instanceof SitemapDataError ? error : new Error('Sitemap generation failed');
    }
  },
  ['public-sitemap-data-community-v2', process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''],
  { revalidate: 3600 },
);

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

  // Query errors propagate; never publish a static-only/partial success as a fallback.
  const { experiences, communityPosts, publicHosts } = await getSitemapData();

  const latestPublicHosts = Array.from(
    pickLatestPublicHostApplicationsByUser(publicHosts).values()
  );
  const publicHostIds = new Set(
    latestPublicHosts
      .filter((host) => host.user_id && isPublicHostApplicationStatus(host.status))
      .map((host) => String(host.user_id))
  );

  const experienceUrls: MetadataRoute.Sitemap = experiences
    .filter((exp) => isPublicExperienceVisible(exp) && exp.host_id && publicHostIds.has(String(exp.host_id)))
    .map((exp) => ({
      url: buildAbsoluteUrl(`/experiences/${exp.id}`),
      changeFrequency: 'weekly',
      priority: 0.9,
    }));

  const communityUrls: MetadataRoute.Sitemap = communityPosts
    .filter(isCommunityPostIndexable)
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
}
