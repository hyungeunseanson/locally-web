// The public Home API omits internal visibility flags from each experience.
export type HomeExperienceRow = {
  id: number;
  host_id: string | null;
  status?: string | null;
  is_active?: boolean | null;
  title?: string | null;
  title_ko?: string | null;
  title_en?: string | null;
  title_ja?: string | null;
  title_zh?: string | null;
  category?: string | null;
  category_en?: string | null;
  category_ja?: string | null;
  category_zh?: string | null;
  city?: string | null;
  country?: string | null;
  location?: string | null;
  languages?: string[] | null;
  image_url?: string | null;
  photos?: string[] | null;
  rating?: number | null;
  review_count?: number | null;
  price?: number | null;
  duration?: number | null;
  created_at?: string | null;
};

export type PublicHomeExperience = Omit<HomeExperienceRow, 'status' | 'is_active'> & {
  public_image_r2_eligible: boolean;
  is_superhost: boolean;
  card_image_url: string | null;
  available_dates: string[];
  wishlist_count: number;
};
