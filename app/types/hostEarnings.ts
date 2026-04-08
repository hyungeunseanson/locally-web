export type HostSettlementStage = 'in_progress' | 'pending' | 'paid';

export type HostServiceSettlementStage = HostSettlementStage;

export type HostExperienceEarningsSummary = {
  pending_payout_amount: number;
  in_progress_amount: number;
  paid_payout_amount: number;
  payout_item_count: number;
  completed_booking_count: number;
  latest_paid_at: string | null;
  total_payout_amount: number;
};

export type HostServiceEarningsItem = {
  id: string;
  order_id: string;
  request_id: string | null;
  title: string;
  service_date: string | null;
  start_time: string | null;
  status: string;
  payout_status: string | null;
  host_payout_amount: number;
  payout_paid_at: string | null;
  created_at: string;
  settlement_stage: HostServiceSettlementStage;
};

export type HostServiceEarningsSummary = {
  in_progress_amount: number;
  pending_payout_amount: number;
  paid_payout_amount: number;
  completed_service_count: number;
  payout_item_count: number;
  latest_paid_at: string | null;
  total_payout_amount: number;
};

export type HostServiceEarningsResponse = {
  success: true;
  summary: HostServiceEarningsSummary;
  items: HostServiceEarningsItem[];
};

export type HostUnifiedEarningsSummary = {
  total_pending_payout_amount: number;
  total_in_progress_amount: number;
  total_paid_amount: number;
  latest_paid_at: string | null;
  experience: HostExperienceEarningsSummary;
  service: HostServiceEarningsSummary;
};

export type HostUnifiedEarningsSummaryResponse = {
  success: true;
  summary: HostUnifiedEarningsSummary;
};
