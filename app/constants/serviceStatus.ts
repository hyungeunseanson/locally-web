// =============================================================================
// Locally: 서비스 매칭 시스템 상태 상수
// 기존 bookingStatus.ts와 완전 독립, 패턴은 동일하게 준수
// =============================================================================

import type { ServiceRequestStatus, ServiceApplicationStatus, ServiceBookingStatus } from '@/app/types/service';

// -----------------------------------------------------------------------------
// service_requests 상태 집합
// -----------------------------------------------------------------------------
export const SERVICE_REQUEST_PENDING_PAYMENT_STATUSES = ['pending_payment'] as const; // v2: 에스크로 결제 대기
export const SERVICE_REQUEST_ASSIGNING_STATUSES = ['assigning'] as const;
export const SERVICE_REQUEST_OPEN_STATUSES = ['open'] as const; // 레거시 전용
export const SERVICE_REQUEST_ACTIVE_STATUSES = ['matched', 'paid', 'confirmed'] as const;
export const SERVICE_REQUEST_COMPLETED_STATUSES = ['completed'] as const;
export const SERVICE_REQUEST_CLOSED_STATUSES = ['cancelled', 'expired'] as const;

// 레거시 호환용. 신규 호스트 화면에는 공개 의뢰 목록을 노출하지 않는다.
export const SERVICE_REQUEST_VISIBLE_STATUSES = [...SERVICE_REQUEST_OPEN_STATUSES] as const;

// 결제는 의뢰 등록 직후, 호스트 배정은 관리자가 별도로 진행한다.
export const SERVICE_REQUEST_PAYABLE_STATUS = 'pending_payment' as const;

// -----------------------------------------------------------------------------
// service_applications 상태 집합
// -----------------------------------------------------------------------------
export const SERVICE_APPLICATION_PENDING_STATUSES = ['pending'] as const;
export const SERVICE_APPLICATION_SELECTED_STATUSES = ['selected'] as const;
export const SERVICE_APPLICATION_REJECTED_STATUSES = ['rejected', 'withdrawn'] as const;

// -----------------------------------------------------------------------------
// service_bookings 상태 집합 (기존 bookingStatus.ts 패턴 준수)
// -----------------------------------------------------------------------------
export const SERVICE_BOOKING_PENDING_STATUSES = ['PENDING'] as const;
export const SERVICE_BOOKING_ACTIVE_STATUSES = ['PAID', 'confirmed'] as const;
export const SERVICE_BOOKING_COMPLETED_STATUSES = ['completed'] as const;
export const SERVICE_BOOKING_CANCELLED_STATUSES = ['cancelled', 'cancellation_requested'] as const;

// -----------------------------------------------------------------------------
// 판정 유틸 함수 (문자열 비교는 반드시 이 유틸로 처리)
// -----------------------------------------------------------------------------

// service_requests
export const isPendingPaymentServiceRequest = (status: string) => status === 'pending_payment'; // v2 에스크로
export const isAssigningServiceRequest = (status: string) => status === 'assigning';
export const isOpenServiceRequest = (status: string) => status === 'open';
export const isMatchedServiceRequest = (status: string) => status === 'matched';
export const isPaidServiceRequest = (status: string) => status === 'paid';
export const isConfirmedServiceRequest = (status: string) => status === 'confirmed';
export const isCompletedServiceRequest = (status: string) => status === 'completed';
export const isCancelledServiceRequest = (status: string) =>
  ['cancelled', 'expired'].includes(status);
export const isActiveServiceRequest = (status: string) =>
  (SERVICE_REQUEST_ACTIVE_STATUSES as readonly string[]).includes(status);

// service_applications
export const isPendingApplication = (status: string) => status === 'pending';
export const isSelectedApplication = (status: string) => status === 'selected';
export const isRejectedApplication = (status: string) =>
  ['rejected', 'withdrawn'].includes(status);

// service_bookings
export const isPendingServiceBooking = (status: string) => status === 'PENDING';
export const isPaidServiceBooking = (status: string) =>
  (SERVICE_BOOKING_ACTIVE_STATUSES as readonly string[]).includes(status) || status === 'PAID';
export const isCompletedServiceBooking = (status: string) => status === 'completed';
export const isCancelledServiceBooking = (status: string) =>
  (SERVICE_BOOKING_CANCELLED_STATUSES as readonly string[]).includes(status);
export const isCancellationRequestedServiceBooking = (status: string) =>
  status === 'cancellation_requested';

// -----------------------------------------------------------------------------
// UI 레이블 헬퍼 (ServiceRequestStatus → 표시 문자열)
// -----------------------------------------------------------------------------
export const getServiceRequestStatusLabel = (
  status: ServiceRequestStatus,
  locale: 'ko' | 'en' | 'ja' | 'zh' = 'ko'
): string => {
  const labels: Record<typeof locale, Record<ServiceRequestStatus, string>> = {
    ko: { pending_payment: '결제 대기', assigning: '관리자 배정 중', open: '관리자 배정 중(구버전)', matched: '호스트 배정 완료', paid: '결제 완료', confirmed: '확정', completed: '완료', cancellation_requested: '취소 검토 중', cancelled: '취소됨', expired: '기간 만료' },
    en: { pending_payment: 'Payment pending', assigning: 'Manager assigning', open: 'Manager assigning (legacy)', matched: 'Host assigned', paid: 'Paid', confirmed: 'Confirmed', completed: 'Completed', cancellation_requested: 'Cancellation review', cancelled: 'Cancelled', expired: 'Expired' },
    ja: { pending_payment: '決済待ち', assigning: 'スタッフ手配中', open: 'スタッフ手配中（旧）', matched: 'ホスト手配済み', paid: '決済完了', confirmed: '確定', completed: '完了', cancellation_requested: 'キャンセル確認中', cancelled: 'キャンセル済み', expired: '期限切れ' },
    zh: { pending_payment: '待付款', assigning: '管理员安排中', open: '管理员安排中（旧）', matched: '已安排向导', paid: '已付款', confirmed: '已确认', completed: '已完成', cancellation_requested: '取消审核中', cancelled: '已取消', expired: '已过期' },
  };
  return labels[locale][status] ?? status;
};

export const getServiceApplicationStatusLabel = (status: ServiceApplicationStatus): string => {
  const labels: Record<ServiceApplicationStatus, string> = {
    pending: '검토 중',
    selected: '선택됨',
    rejected: '미선택',
    withdrawn: '철회됨',
  };
  return labels[status] ?? status;
};

export const getServiceBookingStatusLabel = (status: ServiceBookingStatus): string => {
  const labels: Record<ServiceBookingStatus, string> = {
    PENDING: '결제 대기',
    PAID: '결제 완료',
    confirmed: '확정',
    completed: '이용 완료',
    cancelled: '취소됨',
    cancellation_requested: '취소 요청',
  };
  return labels[status] ?? status;
};
