const TIMEZONE = 'Asia/Seoul';
const DAY_IN_MS = 24 * 60 * 60 * 1000;

export type BookingCancellationPolicyInput = {
  tourDate: string;
  tourTime: string;
  paymentDate: string;
  now?: Date;
};

export type BookingCancellationPolicyResult = {
  rate: number;
  reason: string;
};

type DateParts = {
  year: number;
  month: number;
  day: number;
};

function getKstDateParts(date: Date): DateParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value || 0);

  return {
    year: getPart('year'),
    month: getPart('month'),
    day: getPart('day'),
  };
}

function parseTourDateParts(tourDate: string): DateParts | null {
  const match = tourDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function datePartsToDayIndex(parts: DateParts) {
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / DAY_IN_MS);
}

export function calculateGuestCancellationRefundRate(
  input: BookingCancellationPolicyInput
): BookingCancellationPolicyResult {
  const now = input.now ?? new Date();
  const paymentDate = new Date(input.paymentDate);
  const paymentDateParts = Number.isNaN(paymentDate.getTime()) ? null : getKstDateParts(paymentDate);
  const cancelDateParts = getKstDateParts(now);
  const tourDateParts = parseTourDateParts(input.tourDate);

  if (!tourDateParts || !paymentDateParts) {
    return { rate: 0, reason: '환불 정책 계산 불가' };
  }

  const cancelDayIndex = datePartsToDayIndex(cancelDateParts);
  const tourDayIndex = datePartsToDayIndex(tourDateParts);
  const paymentDayIndex = datePartsToDayIndex(paymentDateParts);
  const daysUntilTour = tourDayIndex - cancelDayIndex;

  if (daysUntilTour <= 0) {
    return { rate: 0, reason: '당일/지난 일정' };
  }

  if (cancelDayIndex === paymentDayIndex) {
    return { rate: 100, reason: '결제 당일 취소' };
  }

  if (daysUntilTour >= 20) {
    return { rate: 100, reason: '20일 전 취소' };
  }

  if (daysUntilTour >= 8) {
    return { rate: 80, reason: '8~19일 전 취소' };
  }

  if (daysUntilTour >= 2) {
    return { rate: 70, reason: '2~7일 전 취소' };
  }

  if (daysUntilTour === 1) {
    return { rate: 40, reason: '1일 전 취소' };
  }

  return { rate: 0, reason: '당일/지난 일정' };
}
