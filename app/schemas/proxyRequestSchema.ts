import { z } from 'zod';

const OptionalText = (max: number) => z.string().max(max).optional();

const RequiredBusinessLink = z
  .string()
  .trim()
  .min(1, '업장 링크 주소를 입력해주세요.')
  .max(500, '업장 링크 주소는 500자 이하로 입력해주세요.')
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'http 또는 https로 시작하는 올바른 업장 링크 주소를 입력해주세요.');

const RequiredBusinessPhone = z
  .string()
  .trim()
  .min(1, '업장 전화번호를 입력해주세요.')
  .max(100, '업장 전화번호는 100자 이하로 입력해주세요.')
  .refine((value) => value.replace(/\D/g, '').length >= 6, '업장 전화번호를 입력해주세요.');

export const RestaurantFormSchema = z.object({
  restaurant_name: z.string().min(1, '식당 이름을 입력해주세요.').max(200, '식당 이름은 200자 이하로 입력해주세요.'),
  google_map_url: RequiredBusinessLink,
  restaurant_phone: RequiredBusinessPhone,
  preferred_slot_primary: z.string().min(1, '예약 희망 일시 1지망을 입력해주세요.'),
  preferred_slot_secondary: z.string().min(1, '예약 희망 일시 2지망을 입력해주세요.'),
  preferred_slot_tertiary: z.string().min(1, '예약 희망 일시 3지망을 입력해주세요.'),
  reservation_name: z.string().min(1, '예약자 성함을 입력해주세요.').max(100, '예약자 성함은 100자 이하로 입력해주세요.'),
  guest_number: z.number().min(1, '인원수를 입력해주세요.'),
  korean_contact: z.string().min(7, '한국 연락처를 입력해주세요.').max(100, '한국 연락처는 100자 이하로 입력해주세요.'),
  local_hotel_contact: OptionalText(200),
  request_notes: OptionalText(2000),
  alternative_restaurant_mode: z.enum(['NONE', 'ALLOW_ONE_REPLACEMENT']),
  alternative_restaurant_notes: OptionalText(500),
  notice_acknowledged: z.boolean(),
  deposit_fee_checked: z.enum(['YES', 'NO', 'UNKNOWN']),
  restaurant_service_option: z.enum(['STANDARD', 'ZERO_ONE_TWO_ZERO', 'KUITEI']).default('STANDARD'),
});

export type RestaurantFormData = z.infer<typeof RestaurantFormSchema>;

export const HotelFormSchema = z.object({
  property_name: z.string().min(1, '숙소 이름을 입력해주세요.').max(200, '숙소 이름은 200자 이하로 입력해주세요.'),
  property_link: RequiredBusinessLink,
  property_phone: RequiredBusinessPhone,
  booking_platform: OptionalText(100),
  reservation_number: OptionalText(100),
  reservation_name: z.string().min(1, '예약자 성함을 입력해주세요.').max(100, '예약자 성함은 100자 이하로 입력해주세요.'),
  checkin_date: z.string().min(1, '체크인 날짜를 입력해주세요.'),
  checkout_date: z.string().min(1, '체크아웃 날짜를 입력해주세요.'),
  hotel_inquiry_type: z.enum(['CHANGE', 'CANCEL', 'GENERAL']),
  request_content: z.string().min(1, '요청 내용을 입력해주세요.').max(2000, '요청 내용은 2000자 이하로 입력해주세요.'),
  desired_change: OptionalText(1000),
  korean_contact: z.string().min(7, '한국 연락처를 입력해주세요.').max(100, '한국 연락처는 100자 이하로 입력해주세요.'),
  additional_notes: OptionalText(2000),
  notice_acknowledged: z.boolean(),
  fee_policy_checked: z.enum(['YES', 'NO', 'UNKNOWN']),
});

export type HotelFormData = z.infer<typeof HotelFormSchema>;

export const TransportFormSchema = z.object({
  reservation_type: z.enum(['TAXI', 'HOTEL_TAXI', 'SHUTTLE_BUS', 'OTHER']),
  business_name: z.string().min(1, '업체 이름을 입력해주세요.').max(200, '업체 이름은 200자 이하로 입력해주세요.'),
  business_link: RequiredBusinessLink,
  business_phone: RequiredBusinessPhone,
  service_area: z.string().min(1, '이용 지역을 입력해주세요.').max(200, '이용 지역은 200자 이하로 입력해주세요.'),
  reservation_name: z.string().min(1, '예약자 성함을 입력해주세요.').max(100, '예약자 성함은 100자 이하로 입력해주세요.'),
  korean_contact: z.string().min(7, '한국 연락처를 입력해주세요.').max(100, '한국 연락처는 100자 이하로 입력해주세요.'),
  use_date: z.string().min(1, '이용 날짜를 입력해주세요.'),
  use_time: z.string().min(1, '이용 시간을 입력해주세요.'),
  departure_location: z.string().min(1, '출발 장소를 입력해주세요.').max(200, '출발 장소는 200자 이하로 입력해주세요.'),
  arrival_location: z.string().min(1, '도착 장소를 입력해주세요.').max(200, '도착 장소는 200자 이하로 입력해주세요.'),
  passenger_number: z.number().min(1, '인원수를 입력해주세요.'),
  baggage_count: z.number().min(0, '짐 개수는 0 이상이어야 합니다.').optional(),
  accommodation_reference: OptionalText(200),
  flight_number: OptionalText(100),
  additional_notes: OptionalText(2000),
  notice_acknowledged: z.boolean(),
});

export type TransportFormData = z.infer<typeof TransportFormSchema>;

export const GeneralInquiryFormSchema = z.object({
  business_name: z.string().min(1, '업장명을 입력해주세요.').max(200, '업장명은 200자 이하로 입력해주세요.'),
  business_phone: RequiredBusinessPhone,
  business_link: RequiredBusinessLink,
  general_inquiry_type: z.enum(['STOCK_CHECK', 'BUSINESS_HOURS', 'RESERVATION_AVAILABILITY', 'OTHER']),
  inquiry_content: z.string().min(1, '문의 내용을 입력해주세요.').max(2000, '문의 내용은 2000자 이하로 입력해주세요.'),
  preferred_check_time: OptionalText(200),
  korean_contact: z.string().min(7, '한국 연락처를 입력해주세요.').max(100, '한국 연락처는 100자 이하로 입력해주세요.'),
  additional_notes: OptionalText(2000),
  notice_acknowledged: z.boolean(),
});

export type GeneralInquiryFormData = z.infer<typeof GeneralInquiryFormSchema>;

export const LostAndFoundFormSchema = z.object({
  location_name: z.string().min(1, '분실 장소를 입력해주세요.').max(200, '분실 장소는 200자 이하로 입력해주세요.'),
  location_link: RequiredBusinessLink,
  location_phone: RequiredBusinessPhone,
  lost_date: z.string().min(1, '분실 날짜를 입력해주세요.'),
  lost_time_window: z.string().min(1, '분실 시간대를 입력해주세요.').max(200, '분실 시간대는 200자 이하로 입력해주세요.'),
  item_type: z.string().min(1, '분실물 종류를 입력해주세요.').max(100, '분실물 종류는 100자 이하로 입력해주세요.'),
  item_description: z.string().min(1, '분실물 특징을 입력해주세요.').max(1000, '분실물 특징은 1000자 이하로 입력해주세요.'),
  last_seen_context: z.string().min(1, '마지막으로 확인한 장소 또는 상황을 입력해주세요.').max(2000, '설명은 2000자 이하로 입력해주세요.'),
  reservation_name: z.string().min(1, '예약자 성함을 입력해주세요.').max(100, '예약자 성함은 100자 이하로 입력해주세요.'),
  korean_contact: z.string().min(7, '한국 연락처를 입력해주세요.').max(100, '한국 연락처는 100자 이하로 입력해주세요.'),
  local_stay_name: OptionalText(200),
  additional_notes: OptionalText(2000),
  notice_acknowledged: z.boolean(),
});

export type LostAndFoundFormData = z.infer<typeof LostAndFoundFormSchema>;

const BaseProxyRequestSchema = z.object({
  category_data: z.discriminatedUnion('category', [
    z.object({
      category: z.literal('RESTAURANT'),
      form_data: RestaurantFormSchema,
    }),
    z.object({
      category: z.literal('HOTEL'),
      form_data: HotelFormSchema,
    }),
    z.object({
      category: z.literal('TRANSPORT'),
      form_data: TransportFormSchema,
    }),
    z.object({
      category: z.literal('GENERAL'),
      form_data: GeneralInquiryFormSchema,
    }),
    z.object({
      category: z.literal('LOST_AND_FOUND'),
      form_data: LostAndFoundFormSchema,
    }),
  ]),
  agreed_to_terms: z.boolean().refine((value) => value === true, {
    message: '서비스 기준 및 환불 규정에 동의하셔야 진행할 수 있습니다.',
  }),
});

const NaverPaymentTrackSchema = BaseProxyRequestSchema.extend({
  payment_channel: z.literal('NAVER'),
  naver_buyer_name: z.string().min(2, '네이버 구매자명을 입력해주세요.').max(200, '구매자명은 200자 이하로 입력해주세요.'),
});

const LocallyPaymentTrackSchema = BaseProxyRequestSchema.extend({
  payment_channel: z.literal('LOCALLY'),
  payment_method: z.enum(['card', 'bank']),
  contact_name: z.string().min(1, '결제자 이름을 입력해주세요.').max(100, '이름은 100자 이하로 입력해주세요.'),
  contact_phone: z.string().min(7, '결제 연락처를 입력해주세요.').max(30, '연락처 형식이 올바르지 않습니다.'),
});

export const ProxyRequestValidationSchema = z.discriminatedUnion('payment_channel', [
  NaverPaymentTrackSchema,
  LocallyPaymentTrackSchema,
]);

export type ProxyRequestPayload = z.infer<typeof ProxyRequestValidationSchema>;
