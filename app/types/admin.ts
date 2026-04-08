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
  payout_paid_at?: string | null;
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

export type AdminApprovalTable = 'host_applications' | 'experiences';
export type AdminItemId = string | number;

export type AdminStatusChangeExecutor = (
  table: AdminApprovalTable,
  id: AdminItemId,
  status: string,
  comment?: string
) => Promise<boolean>;

export type AdminStatusChangeRequestHandler = (
  table: AdminApprovalTable,
  id: AdminItemId,
  status: string
) => Promise<void> | void;

export type AdminDeleteExecutor = (table: string, id: AdminItemId) => Promise<boolean> | void;
export type AdminDeleteRequestHandler = (table: string, id: AdminItemId) => Promise<void> | void;

export interface ExperienceApprovalItem {
  id: AdminItemId;
  created_at: string;
  title: string;
  status: 'pending' | 'active' | 'rejected' | 'revision';
  admin_comment?: string | null;
  price?: number;
  duration?: number;
  max_guests?: number;
  city?: string;
  country?: string;
  subCity?: string;
  is_private_enabled?: boolean;
  private_price?: number;
  category?: string;
  languages?: string[];
  language_levels?: LanguageLevelEntry[];
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

export type AdminPanelSelectedItem = Record<string, unknown> & {
  id: AdminItemId;
  created_at?: string;
  status?: string | null;
  profile_photo?: string | null;
  avatar_url?: string | null;
  name?: string | null;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  host_nationality?: string | null;
  dob?: string | null;
  instagram?: string | null;
  source?: string | null;
  language_cert?: string | null;
  target_language?: string | null;
  self_intro?: string | null;
  motivation?: string | null;
  bank_name?: string | null;
  account_number?: string | null;
  account_holder?: string | null;
  id_card_file?: string | null;
  id_card_signed_url?: string | null;
  admin_comment?: string | null;
  languages?: string[] | null;
  language_levels?: LanguageLevelEntry[] | null;
  photos?: string[] | null;
  price?: number | null;
  duration?: number | null;
  max_guests?: number | null;
  city?: string | null;
  country?: string | null;
  subCity?: string | null;
  is_private_enabled?: boolean | null;
  private_price?: number | null;
  category?: string | null;
  meeting_point?: string | null;
  location?: string | null;
  description?: string | null;
  supplies?: string | null;
  itinerary?: { title: string; description: string }[] | null;
  inclusions?: string[] | null;
  exclusions?: string[] | null;
  rules?: { age_limit?: string; activity_level?: string } | null;
  profiles?: { full_name?: string | null; email?: string | null; name?: string | null; phone?: string | null } | null;
  birth_date?: string | null;
  nationality?: string | null;
  kakao_id?: string | null;
  mbti?: string | null;
  user_name?: string | null;
  user_phone?: string | null;
  user_email?: string | null;
  experience_title?: string | null;
  experiences?: { title?: string | null } | null;
  amount?: number | null;
  total_price?: number | null;
  guests?: number | string | null;
  date?: string | null;
  time?: string | null;
  sender_name?: string | null;
  receiver_name?: string | null;
  content?: string | Record<string, unknown> | null;
};

export interface AdminManagementTabProps {
  activeTab: string;
  filter: string;
  setFilter: (f: string) => void;
  apps: HostApplication[];
  exps: ExperienceApprovalItem[];
  users: AdminPanelSelectedItem[];
  messages: AdminPanelSelectedItem[];
  selectedItem: AdminPanelSelectedItem | null;
  setSelectedItem: (item: AdminPanelSelectedItem | null) => void;
  updateStatus: AdminStatusChangeExecutor;
  deleteItem: AdminDeleteExecutor;
}

export interface AdminDetailsPanelProps {
  activeTab: string;
  selectedItem: AdminPanelSelectedItem | null;
  setSelectedItem: (item: AdminPanelSelectedItem | null) => void;
  onRequestStatusChange: AdminStatusChangeRequestHandler;
  onRequestDeleteItem: AdminDeleteRequestHandler;
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
  payout_paid_at?: string | null;
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

export type AdminPayoutQueueState = 'eligible' | 'hold' | 'long_hold' | 'completed';

export interface AdminPayoutQueueEntry {
  id: string;
  order_id: string | null;
  domain: 'experience' | 'service';
  created_at: string;
  payout_paid_at: string | null;
  date: string | null;
  time: string | null;
  title: string;
  guest_name: string;
  amount: number;
  payout_amount: number;
  platform_revenue: number;
  status: string;
  payout_status: string | null;
}

export interface AdminPayoutQueueDomainGroup {
  host_id: string;
  host_name: string;
  bank: string;
  account_number: string;
  account_holder: string;
  host_nationality: string;
  pending_amount: number;
  paid_amount: number;
  pending_count: number;
  paid_count: number;
  oldest_pending_created_at: string | null;
  settlement_state: AdminPayoutQueueState;
  pending_entries: AdminPayoutQueueEntry[];
  paid_entries: AdminPayoutQueueEntry[];
}

export interface AdminCombinedPayoutQueueRow {
  host_id: string;
  host_name: string;
  bank: string;
  account_number: string;
  account_holder: string;
  host_nationality: string;
  pending_amount: number;
  paid_amount: number;
  pending_count: number;
  paid_count: number;
  settlement_state: AdminPayoutQueueState;
  domains: {
    experience: AdminPayoutQueueDomainGroup | null;
    service: AdminPayoutQueueDomainGroup | null;
  };
}

export type SettlementSyncJobName =
  | 'experience_completion_sync'
  | 'service_completion_sync';

export type SettlementSyncHealthState =
  | 'healthy'
  | 'delayed'
  | 'failed'
  | 'running'
  | 'running_stale';

export type SettlementSyncScope = 'experience' | 'service' | 'all';
export type SettlementSyncTriggerSource = 'cron' | 'manual_run_due' | 'manual_force_one';
export type SettlementSyncTriggerMode = 'run_due' | 'force_one';
export type SettlementSyncTriggerDomain = 'experience' | 'service' | 'all' | 'auto';
export type SettlementSyncTriggerOutcome =
  | 'completed'
  | 'already_processed'
  | 'not_due'
  | 'no_candidates'
  | 'already_running'
  | 'ambiguous_target';

export interface SettlementSyncJobHealth {
  job_name: SettlementSyncJobName;
  health_state: SettlementSyncHealthState;
  is_running: boolean;
  running_since: string | null;
  stale_running: boolean;
  last_success_at: string | null;
  last_failure_at: string | null;
  last_failure_message: string | null;
  last_processed_count: number | null;
  due_candidate_count: number;
  oldest_due_at: string | null;
  lag_minutes: number | null;
}

export interface SettlementSyncStatusResponse {
  success: true;
  generated_at: string;
  jobs: SettlementSyncJobHealth[];
}

export type SettlementSyncTriggerRequest =
  | {
      mode: 'run_due';
      domain: 'experience' | 'service' | 'all';
    }
  | {
      mode: 'force_one';
      domain: 'auto' | 'experience' | 'service';
      identifier: string;
    };

export interface SettlementSyncTriggerResponse {
  success: true;
  mode: SettlementSyncTriggerMode;
  domain: 'experience' | 'service' | 'all';
  run_id: number;
  outcome: SettlementSyncTriggerOutcome;
  processed_count: number;
  skipped_count: number;
  target?: {
    booking_id: string;
    order_id: string | null;
    request_id?: string | null;
  };
  message: string;
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
