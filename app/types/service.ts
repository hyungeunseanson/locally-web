// =============================================================================
// Locally: 맞춤형 동행/통역 서비스 — 관리자 직접 배정 시스템 타입 정의
// 기존 experiences / bookings 타입과 완전 독립
// =============================================================================

// service_requests 상태 플로우 (관리자 배정)
// pending_payment → (결제) → assigning → (관리자 배정) → matched → completed
// pending_payment → cancelled (결제 포기)
// assigning → cancelled (배정 전 취소 + PG 환불)
// matched → cancelled (매칭 후 취소 — 관리자 검토)
export type ServiceRequestStatus =
  | 'pending_payment'  // v2: 결제 대기 (잡보드 미노출)
  | 'assigning'        // 결제 확인, 관리자 직접 배정 중
  | 'open'
  | 'matched'
  | 'paid'             // 레거시 호환
  | 'confirmed'        // 레거시 호환
  | 'completed'
  | 'cancellation_requested'
  | 'cancelled'
  | 'expired';

export type ServiceType = 'general' | 'business';
export type ServicePricingTier = 'standard' | 'premium';
export type ServicePricingReason =
  | 'standard'
  | 'business'
  | 'group_6_plus'
  | 'business_and_group_6_plus';

export type ServiceScheduleItemInput = {
  serviceDate: string;
  startTime: string;
  durationHours: number;
};

export type ServiceScheduleItem = ServiceScheduleItemInput & {
  id: string;
  sortOrder: number;
};

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
  service_type: ServiceType;
  pricing_tier: ServicePricingTier;
  pricing_reason: ServicePricingReason;
  service_end_at: string | null;
  schedule?: ServiceScheduleItem[];

  // 가격 (generated columns — 외부 수수료율 노출 금지)
  hourly_rate_customer: number;  // 표준 35,000 / 프리미엄 55,000
  hourly_rate_host: number | null; // 표준 20,000, 프리미엄은 배정 시 확정
  total_customer_price: number;  // 고객 시간당 단가 × 총 이용시간
  total_host_payout: number | null; // 고객 UI 노출 금지

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
  application_id: string | null;
  customer_id: string;
  host_id: string | null;
  amount: number;
  tid: string | null;
  status: ServiceBookingStatus;
  payment_method: string | null;
  host_payout_amount: number | null;
  platform_revenue: number | null;
  payout_status: string | null;
  payout_paid_at: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  cancel_reason: string | null;
  refund_amount: number | null;
  host_compensation_amount: number | null;
  created_at: string;
  updated_at: string;
};

// =============================================================================
// JOIN 포함 확장 타입 (UI용)
// =============================================================================

// 레거시 지원 데이터 조회에만 사용하는 타입. 신규 고객/호스트 UI에서는 사용하지 않는다.
export type ServiceApplicationWithProfile = ServiceApplication & {
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    languages: string[] | null;
    created_at: string | null;
    job: string | null;
    dream_destination: string | null;
    favorite_song: string | null;
  } | null;
  host_applications?: {
    name: string | null;
    profile_photo: string | null;
    self_intro: string | null;
    languages: string[] | null;
    language_levels?: unknown; // JSON: LanguageLevelEntry[]
    host_nationality?: string | null;
  } | null;
  // 후기 집계 (클라이언트에서 계산)
  review_count?: number;
  review_avg?: number;
};

// 고객의 내 맞춤 의뢰 목록에서 사용하는 안전 DTO 타입
export type ServiceRequestCard = Pick<
  ServiceRequest,
  | 'id'
  | 'title'
  | 'city'
  | 'country'
  | 'service_date'
  | 'start_time'
  | 'duration_hours'
  | 'guest_count'
  | 'service_type'
  | 'pricing_reason'
  | 'service_end_at'
  | 'total_customer_price'
  | 'status'
  | 'created_at'
>;

// 원자적 예약 RPC 반환 타입
export type ServiceBookingAtomicResult = {
  new_order_id: string;
  final_amount: number;
  host_payout: number;
  platform_margin: number;
  host_id: string;
};
