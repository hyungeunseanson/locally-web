import { expect, test } from '@playwright/test';

import { getProxyRequestFeeKrw, getProxyRequestTitle } from '@/app/utils/proxyBooking';

test.describe('Proxy booking pricing helpers', () => {
  test('maps the active service fees conservatively', () => {
    expect(
      getProxyRequestFeeKrw('RESTAURANT', {
        restaurant_service_option: 'STANDARD',
      })
    ).toBe(4500);

    expect(
      getProxyRequestFeeKrw('RESTAURANT', {
        restaurant_service_option: 'ZERO_ONE_TWO_ZERO',
      })
    ).toBe(8000);

    expect(
      getProxyRequestFeeKrw('RESTAURANT', {
        restaurant_service_option: 'KUITEI',
      })
    ).toBe(9000);

    expect(getProxyRequestFeeKrw('HOTEL', {})).toBe(6000);
    expect(getProxyRequestFeeKrw('TRANSPORT', {})).toBe(6000);
    expect(getProxyRequestFeeKrw('GENERAL', {})).toBe(6000);
    expect(getProxyRequestFeeKrw('LOST_AND_FOUND', {})).toBe(9000);
  });

  test('prefers stored fee and expands titles for new categories', () => {
    expect(
      getProxyRequestFeeKrw('GENERAL', {
        service_fee_krw: 12345,
      })
    ).toBe(12345);

    expect(
      getProxyRequestTitle({
        category: 'HOTEL',
        form_data: { property_name: '료칸 테스트' },
      } as never)
    ).toBe('료칸 테스트');

    expect(
      getProxyRequestTitle({
        category: 'GENERAL',
        form_data: { business_name: '도쿄 약국' },
      } as never)
    ).toBe('도쿄 약국');
  });
});
