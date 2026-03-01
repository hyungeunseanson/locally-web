// =============================================================================
// Locally: 맞춤형 동행/통역 서비스 — 역경매 매칭 시스템 타입 정의
// 기존 experiences / bookings 타입과 완전 독립
// =============================================================================

// service_requests 상태 플로우 (v2 에스크로)
// pending_payment → (결제) → open → (호스트 선택) → matched → completed
// pending_payment → cancelled (결제 포기)
// open → cancelled (결제 후 호스트 미선택 상태에서 취소 + PG 환불)
// matched → cancelled (매칭 후 취소 — 관리자 검토)
export type ServiceRequestStatus =
  | 'pending_payment'  // v2: 결제 대기 (잡보드 미노출)
  | 'open'
  | 'matched'
  | 'paid'             // 레거시 호환
  | 'confirmed'        // 레거시 호환
  | 'completed'
  | 'cancelled'
  | 'expired';

// service_applications 상태
export type ServiceApplicationStatus =
  | 'pending'
  | 'selected'
  | 'rejected'
  | 'withdrawn';

// service_bookings 상태
export type ServiceBookingStatus =
  | 'PENDING'
  | 'PAID'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'cancellation_requested';

// =============================================================================
// DB Row 타입
// =============================================================================

export type ServiceRequest = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  city: string;
  country: string;
  service_date: string;       // DATE → ISO string
  start_time: string;
  duration_hours: number;
  languages: string[];
  guest_count: number;

  // 가격 (generated columns — 외부 수수료율 노출 금지)
  hourly_rate_customer: number;  // 35,000 (고객 단가)
  hourly_rate_host: number;      // 20,000 (호스트 단가, 절대 UI 노출 금지)
  total_customer_price: number;  // 35,000 × hours
  total_host_payout: number;     // 20,000 × hours (절대 UI 노출 금지)

  status: ServiceRequestStatus;
  selected_application_id: string | null;
  selected_host_id: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
};

export type ServiceApplication = {
  id: string;
  request_id: string;
  host_id: string;
  appeal_message: string;
  status: ServiceApplicationStatus;
  created_at: string;
  updated_at: string;
};

export type ServiceBooking = {
  id: string;
  order_id: string;
  request_id: string;
  application_id: string;
  customer_id: string;
  host_id: string;
  amount: number;
  tid: string | null;
  status: ServiceBookingStatus;
  payment_method: string | null;
  host_payout_amount: number | null;
  platform_revenue: number | null;
  payout_status: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  cancel_reason: string | null;
  refund_amount: number | null;
  created_at: string;
  updated_at: string;
};

// =============================================================================
// JOIN 포함 확장 타입 (UI용)
// =============================================================================

// 의뢰 상세에서 호스트 지원자 카드에 필요한 정보
export type ServiceApplicationWithProfile = ServiceApplication & {
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    languages: string[] | null;
  } | null;
  host_applications?: {
    name: string | null;
    profile_photo: string | null;
    self_intro: string | null;
    languages: string[] | null;
  } | null;
  // 후기 집계 (클라이언트에서 계산)
  review_count?: number;
  review_avg?: number;
};

// 잡보드(서비스 목록)에서 사용하는 의뢰 카드 타입
export type ServiceRequestCard = Pick<
  ServiceRequest,
  | 'id'
  | 'title'
  | 'city'
  | 'country'
  | 'service_date'
  | 'start_time'
  | 'duration_hours'
  | 'languages'
  | 'guest_count'
  | 'total_customer_price'
  | 'total_host_payout'
  | 'status'
  | 'created_at'
  | 'user_id'
>;

// 원자적 예약 RPC 반환 타입
export type ServiceBookingAtomicResult = {
  new_order_id: string;
  final_amount: number;
  host_payout: number;
  platform_margin: number;
  host_id: string;
};
