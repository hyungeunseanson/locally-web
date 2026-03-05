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

export interface AdminBooking extends Omit<any, 'experiences' | 'profiles'> {
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
  email: string;
  status: 'pending' | 'approved' | 'rejected' | 'revision';
  languages?: string[];
  language_levels?: LanguageLevelEntry[];
  language_cert?: string | null;
  content: any;
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

export interface AdminDashboardState {
  apps: HostApplication[];
  exps: any[];
  users: Profile[];
  bookings: AdminBooking[];
  reviews: any[];
  onlineUsers: any[];
  isLoading: boolean;
  searchLogs?: any[]; // 🟢 추가: 검색 트렌드 분석용
  analyticsEvents?: any[]; // 🟢 추가: 퍼널 분석용
  inquiries?: any[]; // 🟢 추가: 호스트 응답률 계산용
  inquiryMessages?: any[]; // 🟢 추가: 호스트 응답 시간 계산용
}
