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

export interface AdminSalesBooking extends AdminBooking {
  order_id: string | null;
  payout_status: string | null;
  host_payout_amount: number | null;
  platform_revenue: number | null;
  refund_amount: number | null;
  payment_method: string | null;
  total_price?: number | null;
  total_experience_price?: number | null;
  price_at_booking?: number | null;
  solo_guarantee_price?: number | null;
  host_application: {
    name: string | null;
    bank_name: string | null;
    account_number: string | null;
    account_holder: string | null;
    host_nationality: string | null;
  } | null;
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

export interface ExperienceApprovalItem {
  id: string;
  created_at: string;
  title: string;
  status: 'pending' | 'active' | 'rejected' | 'revision';
  price?: number;
  duration?: number;
  max_guests?: number;
  city?: string;
  country?: string;
  subCity?: string;
  is_private_enabled?: boolean;
  private_price?: number;
  category?: string;
  meeting_point?: string;
  location?: string;
  description?: string;
  supplies?: string;
  itinerary?: { title: string; description: string }[];
  inclusions?: string[];
  exclusions?: string[];
  photos?: string[];
  rules?: { age_limit?: string; activity_level?: string };
  profiles?: { full_name: string | null; email: string | null };
}

export interface AdminManagementTabProps {
  activeTab: string;
  filter: string;
  setFilter: (f: string) => void;
  apps: HostApplication[];
  exps: ExperienceApprovalItem[];
  users: any[];
  messages: any[];
  selectedItem: any;
  setSelectedItem: (item: any) => void;
  updateStatus: (table: 'host_applications' | 'experiences', id: string, status: string, comment?: string) => Promise<boolean> | void;
  deleteItem: (table: string, id: string) => Promise<boolean> | void;
}

export interface AdminDetailsPanelProps {
  activeTab: string;
  selectedItem: any;
  setSelectedItem: (item: any) => void;
  updateStatus: (table: 'host_applications' | 'experiences', id: string, status: string, comment?: string) => Promise<boolean> | void;
  deleteItem: (table: string, id: string) => Promise<boolean> | void;
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

export interface AdminUserActivityBooking {
  id: string;
  created_at: string;
  amount: number | null;
  total_price: number | null;
  status: string | null;
  guests: number | null;
  date: string | null;
  time: string | null;
  experience_title: string | null;
}

export interface AdminUserTimelineItem {
  id: string;
  occurred_at: string;
  kind: 'booking' | 'review' | 'service_request' | 'service_booking' | 'inquiry';
  title: string;
  description: string | null;
  status: string | null;
  status_label: string | null;
  amount: number | null;
}

export interface AdminUserDashboardRow extends Omit<Profile, 'role'> {
  role?: string | null;
  total_spent?: number;
  experience_booking_count?: number;
  service_request_count?: number;
  recent_activity_at?: string | null;
  last_active_at?: string | null;
  created_at?: string | null;
  email?: string | null;
  birth_date?: string | null;
  nationality?: string | null;
  kakao_id?: string | null;
  mbti?: string | null;
}

export interface OnlineUser {
  user_id: string;
  is_anonymous?: boolean;
  avatar_url?: string | null;
  full_name?: string | null;
  email?: string | null;
  [key: string]: unknown;
}
