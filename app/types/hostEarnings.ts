export type HostServiceSettlementStage = 'in_progress' | 'pending' | 'paid';

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
};

export type HostServiceEarningsResponse = {
  success: true;
  summary: HostServiceEarningsSummary;
  items: HostServiceEarningsItem[];
};
