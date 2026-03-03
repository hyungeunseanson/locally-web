import { z } from 'zod';

// ============================================================================
// [1] 카테고리별 개별 동적 폼 스키마 (form_data 내부 JSONB 구조용)
// ============================================================================

// A. 식당 카테고리 (RESTAURANT)
export const RestaurantFormSchema = z.object({
    restaurant_name: z.string().min(1, '식당 이름을 입력해주세요.'),
    branch_name: z.string().optional(),
    target_date: z.string().min(1, '예약 날짜를 선택해주세요.'),
    target_time: z.string().min(1, '예약 시간을 입력해주세요.'),
    guest_number: z.number().min(1, '방문 인원을 입력해주세요.'),
    alternative_times: z.string().optional().describe('대안 시간대'),
    special_requests: z.string().optional().describe('특별 요청사항 (알레르기, 기념일 등)'),
});

export type RestaurantFormData = z.infer<typeof RestaurantFormSchema>;

// B. 교통 (택시/버스 예약) 카테고리 (TRANSPORT)
export const TransportFormSchema = z.object({
    transport_type: z.enum(['TAXI', 'BUS', 'TRAIN']),
    departure_location: z.string().min(1, '출발지를 입력해주세요.'),
    arrival_location: z.string().min(1, '도착지를 입력해주세요.'),
    departure_date: z.string().min(1, '출발 날짜를 선택해주세요.'),
    departure_time: z.string().min(1, '출발 시간을 입력해주세요.'),
    passenger_number: z.number().min(1, '탑승 인원을 입력해주세요.'),
    baggage_count: z.number().optional().describe('수하물 개수'),
});

export type TransportFormData = z.infer<typeof TransportFormSchema>;


// ============================================================================
// [2] 전체 Proxy Request 스키마 (API Body 및 State 검증용)
// ============================================================================

// 공통 스키마 추출 (결제수단 무관)
const BaseProxyRequestSchema = z.object({
    // 카테고리 식별 및 해당 폼 데이터 분기 (z.discriminatedUnion 활용)
    category_data: z.discriminatedUnion('category', [
        z.object({
            category: z.literal('RESTAURANT'),
            form_data: RestaurantFormSchema,
        }),
        z.object({
            category: z.literal('TRANSPORT'),
            form_data: TransportFormSchema,
        }),
        // TODO: HOTEL, LOST_AND_FOUND, GENERAL 등 확장 가능
    ]),

    // 필수 약관 동의 플래그
    agreed_to_terms: z.boolean().refine((val) => val === true, {
        message: '0120 번호 등 추가 요금 발생 및 환불/수수료 규정에 동의하셔야 진행이 가능합니다.',
    }),
});

// A. NAVER (스마트스토어) 트랙: buyer_name 필수
const NaverPaymentTrackSchema = BaseProxyRequestSchema.extend({
    payment_channel: z.literal('NAVER'),
    naver_buyer_name: z.string().min(2, '스마트스토어 구매자명을 정확히 입력해주세요.'),
});

// B. LOCALLY (자체 웹 결제) 트랙: buyer_name 불필요 (자체 PG 프로세스)
const LocallyPaymentTrackSchema = BaseProxyRequestSchema.extend({
    payment_channel: z.literal('LOCALLY'),
});

// 최상위 검증 엔트리 스키마 (Union Schema)
export const ProxyRequestValidationSchema = z.discriminatedUnion('payment_channel', [
    NaverPaymentTrackSchema,
    LocallyPaymentTrackSchema,
]);

// 타입 추론 추출
export type ProxyRequestPayload = z.infer<typeof ProxyRequestValidationSchema>;
