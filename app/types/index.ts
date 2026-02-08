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