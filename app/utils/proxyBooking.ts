import type { ProxyComment, ProxyPaymentMethod, ProxyRequest } from '@/app/types/proxy';

export const PROXY_REQUEST_PRICE_KRW = 5000;

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function hasEmailProfile(
  profile: ProxyRequest['profiles'] | ProxyComment['profiles'] | null | undefined
): profile is { email?: string | null } {
  return Boolean(profile && typeof profile === 'object' && 'email' in profile);
}

export function getProxyPaymentMethod(
  formData: Record<string, unknown> | null | undefined
): ProxyPaymentMethod | null {
  const method = readString(formData?.payment_method);
  if (method === 'card' || method === 'bank') {
    return method;
  }

  return null;
}

export function getProxyRequestTitle(request: Pick<ProxyRequest, 'category' | 'form_data'>) {
  if (request.category === 'RESTAURANT') {
    return readString(request.form_data?.restaurant_name) || '식당 예약 요청';
  }

  if (request.category === 'TRANSPORT') {
    const departure = readString(request.form_data?.departure_location);
    const arrival = readString(request.form_data?.arrival_location);
    if (departure && arrival) {
      return `${departure} → ${arrival}`;
    }
    return '교통 예약 요청';
  }

  return '전화 예약 요청';
}

export function getProxyRequesterDisplayName(
  profile?: ProxyRequest['profiles'] | ProxyComment['profiles'] | null
) {
  if (profile?.full_name?.trim()) {
    return profile.full_name.trim();
  }

  if (hasEmailProfile(profile) && typeof profile.email === 'string' && profile.email.trim()) {
    return profile.email.trim().split('@')[0];
  }

  return '고객';
}
