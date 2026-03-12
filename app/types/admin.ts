import { Profile } from './index';
import { LanguageLevelEntry } from '@/app/utils/languageLevels';

export type AdminTaskType = 'DAILY_LOG' | 'TODO' | 'MEMO';
export type AdminTaskStatus = 'Done' | 'Progress';

export interface AdminTask {
  id: string;
  created_at: string;
  type: AdminTaskType;
  content: string;
  is_completed: boolean;
  author_id: string;
  author_name: string;
  metadata: {
    note?: string;
    status_text?: AdminTaskStatus;
  };
}

export interface AdminComment {
  id: string;
  task_id: string;
  content: string;
  author_name: string;
  created_at: string;
}

export interface AdminBooking {
  [key: string]: unknown;
  id: string;
  created_at: string;
  experience_id: number;
  user_id: string;
  amount: number;
  status: string;
  date: string;
  time: string;
  contact_name?: string;
  contact_phone?: string;
  guests?: number;
  experiences: {
    title: string;
    host_id: string;
    profiles: {
      name: string;
    };
  };
  profiles: {
    email: string;
    name: string;
  };
}

export interface HostApplication {
  id: string;
  created_at: string;
  user_id: string;
  name: string;
  email?: string;
  phone?: string;
  status: 'pending' | 'approved' | 'rejected' | 'revision';
  host_nationality?: string;
  profile_photo?: string | null;
  languages?: string[];
  language_levels?: LanguageLevelEntry[];
  target_language?: string | null;
  language_cert?: string | null;
  dob?: string | null;
  instagram?: string | null;
  source?: string | null;
  self_intro?: string | null;
  motivation?: string | null;
  bank_name?: string | null;
  account_number?: string | null;
  account_holder?: string | null;
  id_card_file?: string | null;
  id_card_signed_url?: string | null;
  admin_comment?: string | null;
  content: Record<string, unknown> | null;
}

export interface AdminServiceBooking {
  id: string;
  order_id: string;
  request_id: string;
  customer_id: string;
  host_id: string | null;
  amount: number;
  host_payout_amount: number | null;
  platform_revenue: number | null; // internal only — never expose ratio in UI
  status: string;
  payout_status: string | null;
  tid: string | null;
  payment_method: string | null;
  cancel_reason: string | null;
  refund_amount: number | null;
  created_at: string;
  // Assembled via manual JOIN
  service_request: {
    title: string;
    description: string;
    city: string;
    service_date: string;
    duration_hours: number;
    status: string;
  } | null;
  customer_profile: { full_name: string | null; email: string | null } | null;
  host_profile: { full_name: string | null } | null;
  host_application: {
    name: string | null;
    bank_name: string | null;
    account_number: string | null;
    account_holder: string | null;
  } | null;
}

export interface AdminMasterLedgerEntry {
  _type: 'experience' | 'service';
  id: string;
  order_id: string | null;
  created_at: string;
  date: string;
  time: string | null;
  amount: number;
  status: string;
  payment_method: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  guests: number | string | null;
  price_at_booking: number | null;
  total_experience_price: number | null;
  host_payout_amount: number | null;
  platform_revenue: number | null;
  refund_amount: number | null;
  cancel_reason: string | null;
  solo_guarantee_price?: number | null;
  experiences: {
    title: string;
    host_id?: string | null;
    profiles: {
      name: string | null;
    };
  };
  profiles: {
    email: string | null;
    name?: string | null;
  };
}

export interface AdminDashboardState {
  apps: HostApplication[];
  exps: unknown[];
  users: Profile[];
  bookings: AdminBooking[];
  reviews: unknown[];
  onlineUsers: unknown[];
  isLoading: boolean;
  searchLogs?: unknown[]; // 🟢 추가: 검색 트렌드 분석용
  analyticsEvents?: unknown[]; // 🟢 추가: 퍼널 분석용
  inquiries?: unknown[]; // 🟢 추가: 호스트 응답률 계산용
  inquiryMessages?: unknown[]; // 🟢 추가: 호스트 응답 시간 계산용
}
