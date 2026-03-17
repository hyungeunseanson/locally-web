import type { CommunityCategory, CommunityHub, CommunityPostFormat } from '@/app/types/community';

export type CommunityHighlightPost = {
  id: string;
  title: string;
  category: CommunityCategory;
  post_format: CommunityPostFormat;
  destination_hub: CommunityHub | null;
  created_at: string;
};
