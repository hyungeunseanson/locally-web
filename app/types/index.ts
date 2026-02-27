export interface Experience {
    id: number;
    host_id: string;
    title: string;
    city: string;
    country: string;
    description: string;
    price: number;
    category: string;
    tags: string[];
    languages: string[];
    photos: string[];
    image_url?: string;
    max_guests: number;
    duration: number;
    meeting_point: string;
    status: 'active' | 'inactive';
    created_at: string;
    available_dates?: string[]; 
  }
  
  export interface Profile {
    id: string;
    name: string;
    avatar_url: string | null;
    introduction?: string;
    bio?: string;
    job?: string;
    dream_destination?: string;
    favorite_song?: string;
    languages?: string[];
    phone?: string;
    role?: string;
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
