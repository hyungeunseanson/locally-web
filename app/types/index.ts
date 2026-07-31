export interface Experience {
    id: number;
    host_id: string;
    title: string;
    title_ko?: string | null;
    title_en?: string | null;
    title_ja?: string | null;
    title_zh?: string | null;
    city: string;
    subCity?: string | null;
    country: string;
    description: string;
    description_ko?: string | null;
    description_en?: string | null;
    description_ja?: string | null;
    description_zh?: string | null;
    price: number;
    category: string;
    category_en?: string | null;
    category_ja?: string | null;
    category_zh?: string | null;
    tags: string[];
    languages: string[];
    photos: string[];
    image_url?: string;
    card_image_url?: string | null;
    max_guests: number;
    duration: number;
    meeting_point: string;
    meeting_point_i18n?: Record<string, string> | null;
    location?: string | null;
    status: 'active' | 'inactive';
    created_at: string;
    available_dates?: string[];
    rating?: number | null;
    review_count?: number | null;
    wishlist_count?: number | null;
    is_superhost?: boolean | null;
  }
  
  export interface Profile {
    id: string;
    name: string;
    full_name?: string;
    avatar_url: string | null;
    introduction?: string;
    bio?: string;
    job?: string;
    dream_destination?: string;
    favorite_song?: string;
    languages?: string[];
    phone?: string;
    role?: string;
    total_spent?: number;
    experience_booking_count?: number;
    service_request_count?: number;
    recent_activity_at?: string | null;
  }

  // 👇 새로 추가: Booking 인터페이스
export interface Booking {
  id: string;
  order_id: string;
  tid?: string; // 🟢 결제 고유 번호 (환불 필수)
  user_id: string;
  experience_id: number;
  amount: number;
  total_price: number;
  status: 'PENDING' | 'PAID' | 'confirmed' | 'completed' | 'cancelled' | 'cancellation_requested' | 'declined';
  guests: number;
  date: string;
  time: string;
  created_at: string;
  user_email?: string; // 조인된 데이터용
}

export * from './paypal';
