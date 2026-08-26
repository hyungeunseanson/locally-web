import { expect, test } from '@playwright/test';

import { ProxyRequestValidationSchema } from '@/app/schemas/proxyRequestSchema';
import {
  buildProxyInquiryInitialMessage,
  getProxyFormDisplayEntries,
  normalizeProxyHotelDesiredChange,
} from '@/app/utils/proxyBooking';

const NAVER_PAYMENT = {
  agreed_to_terms: true,
  payment_channel: 'NAVER' as const,
  naver_buyer_name: '테스트 구매자',
};

test.describe('Proxy booking request form schema', () => {
  test('accepts the required payload for every visible category', () => {
    const payloads = [
      {
        ...NAVER_PAYMENT,
        category_data: {
          category: 'RESTAURANT' as const,
          form_data: {
            restaurant_name: '테스트 식당',
            google_map_url: 'https://maps.example.test/restaurant',
            restaurant_phone: '03-1234-5678',
            preferred_slot_primary: '2026-09-21T19:00',
            preferred_slot_secondary: '2026-09-21T19:30',
            preferred_slot_tertiary: '2026-09-21T20:00',
            reservation_name: '테스트 예약자',
            guest_number: 2,
            korean_contact: '01012345678',
            alternative_restaurant_mode: 'NONE' as const,
            notice_acknowledged: false,
            deposit_fee_checked: 'UNKNOWN' as const,
            restaurant_service_option: 'STANDARD' as const,
          },
        },
      },
      {
        ...NAVER_PAYMENT,
        category_data: {
          category: 'HOTEL' as const,
          form_data: {
            property_name: '테스트 호텔',
            property_link: 'https://maps.example.test/hotel',
            property_phone: '03-1234-5678',
            reservation_name: '테스트 예약자',
            checkin_date: '2026-09-21',
            checkout_date: '2026-09-22',
            hotel_inquiry_type: 'GENERAL' as const,
            request_content: '예약 내용을 확인해주세요.',
            korean_contact: '01012345678',
            notice_acknowledged: false,
            fee_policy_checked: 'UNKNOWN' as const,
          },
        },
      },
      {
        ...NAVER_PAYMENT,
        category_data: {
          category: 'TRANSPORT' as const,
          form_data: {
            reservation_type: 'TAXI' as const,
            business_name: '테스트 택시 업체',
            business_link: 'https://maps.example.test/transport',
            business_phone: '03-1234-5678',
            service_area: '도쿄',
            reservation_name: '테스트 예약자',
            korean_contact: '01012345678',
            use_date: '2026-09-21',
            use_time: '19:00',
            departure_location: '도쿄역',
            arrival_location: '시부야역',
            passenger_number: 2,
            notice_acknowledged: false,
          },
        },
      },
      {
        ...NAVER_PAYMENT,
        category_data: {
          category: 'GENERAL' as const,
          form_data: {
            business_name: '테스트 매장',
            business_link: 'https://maps.example.test/business',
            business_phone: '03-1234-5678',
            general_inquiry_type: 'STOCK_CHECK' as const,
            inquiry_content: '재고를 확인해주세요.',
            korean_contact: '01012345678',
            notice_acknowledged: false,
          },
        },
      },
      {
        ...NAVER_PAYMENT,
        category_data: {
          category: 'LOST_AND_FOUND' as const,
          form_data: {
            location_name: '테스트 호텔',
            location_link: 'https://maps.example.test/lost-and-found',
            location_phone: '03-1234-5678',
            lost_date: '2026-09-21',
            lost_time_window: '18:00~19:00',
            item_type: '지갑',
            item_description: '검은색 지갑입니다.',
            last_seen_context: '호텔 로비에서 마지막으로 확인했습니다.',
            reservation_name: '테스트 예약자',
            korean_contact: '01012345678',
            notice_acknowledged: false,
          },
        },
      },
    ];

    const businessFieldKeysByCategory = {
      RESTAURANT: { link: 'google_map_url', phone: 'restaurant_phone', name: 'restaurant_name' },
      HOTEL: { link: 'property_link', phone: 'property_phone', name: 'property_name' },
      TRANSPORT: { link: 'business_link', phone: 'business_phone', name: 'business_name' },
      GENERAL: { link: 'business_link', phone: 'business_phone', name: 'business_name' },
      LOST_AND_FOUND: { link: 'location_link', phone: 'location_phone', name: 'location_name' },
    } as const;

    for (const payload of payloads) {
      expect(ProxyRequestValidationSchema.safeParse(payload).success, payload.category_data.category).toBe(true);

      const { link, phone, name } = businessFieldKeysByCategory[payload.category_data.category];

      for (const field of [name, link, phone]) {
        const incompletePayload = JSON.parse(JSON.stringify(payload)) as typeof payload;
        delete (incompletePayload.category_data.form_data as Record<string, unknown>)[field];
        expect(
          ProxyRequestValidationSchema.safeParse(incompletePayload).success,
          `${payload.category_data.category}:${field}`
        ).toBe(false);
      }

      for (const invalidLink of ['', '   ', 'abc', '123', 'ftp://example.com', 'javascript:alert(1)']) {
        const invalidPayload = JSON.parse(JSON.stringify(payload)) as typeof payload;
        (invalidPayload.category_data.form_data as Record<string, unknown>)[link] = invalidLink;
        expect(
          ProxyRequestValidationSchema.safeParse(invalidPayload).success,
          `${payload.category_data.category}:${invalidLink}`
        ).toBe(false);
      }

      const mapsShortUrlPayload = JSON.parse(JSON.stringify(payload)) as typeof payload;
      (mapsShortUrlPayload.category_data.form_data as Record<string, unknown>)[link] = 'https://maps.app.goo.gl/Example';
      expect(
        ProxyRequestValidationSchema.safeParse(mapsShortUrlPayload).success,
        `${payload.category_data.category}:maps-short-url`
      ).toBe(true);

      for (const invalidPhone of ['', '   ', 'abc', '------']) {
        const invalidPayload = JSON.parse(JSON.stringify(payload)) as typeof payload;
        (invalidPayload.category_data.form_data as Record<string, unknown>)[phone] = invalidPhone;
        expect(
          ProxyRequestValidationSchema.safeParse(invalidPayload).success,
          `${payload.category_data.category}:${invalidPhone}`
        ).toBe(false);
      }

      for (const validPhone of ['03-1234-5678', '+81 3 1234 5678']) {
        const validPayload = JSON.parse(JSON.stringify(payload)) as typeof payload;
        (validPayload.category_data.form_data as Record<string, unknown>)[phone] = validPhone;
        expect(
          ProxyRequestValidationSchema.safeParse(validPayload).success,
          `${payload.category_data.category}:${validPhone}`
        ).toBe(true);
      }
    }
  });

  test('keeps both locally payment methods compatible with the restaurant payload', () => {
    const categoryData = {
      category: 'RESTAURANT' as const,
      form_data: {
        restaurant_name: '테스트 식당',
        google_map_url: 'https://maps.example.test/restaurant',
        restaurant_phone: '03-1234-5678',
        preferred_slot_primary: '2026-09-21T19:00',
        preferred_slot_secondary: '2026-09-21T19:30',
        preferred_slot_tertiary: '2026-09-21T20:00',
        reservation_name: '테스트 예약자',
        guest_number: 2,
        korean_contact: '01012345678',
        alternative_restaurant_mode: 'NONE' as const,
        notice_acknowledged: false,
        deposit_fee_checked: 'UNKNOWN' as const,
        restaurant_service_option: 'STANDARD' as const,
      },
    };

    for (const payment_method of ['card', 'bank'] as const) {
      expect(
        ProxyRequestValidationSchema.safeParse({
          agreed_to_terms: true,
          payment_channel: 'LOCALLY',
          payment_method,
          contact_name: '테스트 결제자',
          contact_phone: '01012345678',
          category_data: categoryData,
        }).success,
        payment_method
      ).toBe(true);
    }
  });

  test('keeps hotel desired_change only for CHANGE payloads', () => {
    const previousDesiredChange = '체크인 날짜를 하루 뒤로 변경해주세요.';

    const createHotelPayload = (hotelInquiryType: 'CHANGE' | 'CANCEL' | 'GENERAL') => ({
      ...NAVER_PAYMENT,
      category_data: {
        category: 'HOTEL' as const,
        form_data: {
          property_name: '테스트 호텔',
          property_link: 'https://maps.example.test/hotel',
          property_phone: '03-1234-5678',
          reservation_name: '테스트 예약자',
          checkin_date: '2026-09-21',
          checkout_date: '2026-09-22',
          hotel_inquiry_type: hotelInquiryType,
          request_content: '예약 내용을 확인해주세요.',
          desired_change: normalizeProxyHotelDesiredChange(hotelInquiryType, previousDesiredChange),
          korean_contact: '01012345678',
          notice_acknowledged: false,
          fee_policy_checked: 'UNKNOWN' as const,
        },
      },
    });

    const changePayload = createHotelPayload('CHANGE');
    expect(changePayload.category_data.form_data.desired_change).toBe(previousDesiredChange);
    expect(ProxyRequestValidationSchema.safeParse(changePayload).success, 'CHANGE').toBe(true);

    for (const hotelInquiryType of ['CANCEL', 'GENERAL'] as const) {
      const payload = createHotelPayload(hotelInquiryType);
      expect(payload.category_data.form_data.desired_change, hotelInquiryType).toBe('');
      expect(ProxyRequestValidationSchema.safeParse(payload).success, hotelInquiryType).toBe(true);
      expect(
        getProxyFormDisplayEntries(payload.category_data.form_data).some((entry) => entry.key === 'desired_change'),
        hotelInquiryType
      ).toBe(false);
    }
  });

  test('includes the transport business name in the initial operator inquiry', () => {
    const message = buildProxyInquiryInitialMessage({
      category: 'TRANSPORT',
      formData: {
        reservation_type: 'TAXI',
        business_name: '테스트 택시 업체',
        business_link: 'https://maps.example.test/transport',
        business_phone: '03-1234-5678',
      },
      paymentChannel: 'NAVER',
      finalAmount: 6000,
      naverBuyerName: '테스트 구매자',
    });

    expect(message).toContain('- 업장명: 테스트 택시 업체');
  });
});
