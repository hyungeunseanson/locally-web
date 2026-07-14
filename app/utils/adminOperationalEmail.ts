export type AdminPaymentConfirmedEmailParams = {
  domain: 'experience' | 'service';
  title: string;
  orderId: string;
  amount: number;
  paymentMethod: 'card' | 'paypal' | 'bank';
  link: string;
  customerName?: string | null;
};

export type AdminOperationalEmailContent = {
  subject: string;
  title: string;
  message: string;
  link?: string | null;
  ctaLabel?: string;
};

const ADMIN_PAYMENT_METHOD_LABELS: Record<AdminPaymentConfirmedEmailParams['paymentMethod'], string> = {
  card: '카드',
  paypal: 'PayPal',
  bank: '무통장 입금',
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizeAdminAlertEmails(emails: Array<string | null | undefined>) {
  return Array.from(new Set(
    emails
      .filter((email): email is string => typeof email === 'string' && Boolean(email.trim()))
      .map(normalizeEmail)
  ));
}

export function buildAdminPaymentConfirmedEmail(
  params: AdminPaymentConfirmedEmailParams
): AdminOperationalEmailContent {
  const domainLabel = params.domain === 'experience' ? '체험 예약' : '맞춤 의뢰';
  const paymentMethodLabel = ADMIN_PAYMENT_METHOD_LABELS[params.paymentMethod];
  const amount = Number.isFinite(params.amount) ? Math.max(0, Math.round(params.amount)) : 0;
  const messageLines = [
    `상품/의뢰명: ${params.title}`,
    `주문번호: ${params.orderId}`,
    `결제수단: ${paymentMethodLabel}`,
    `결제금액: ₩${amount.toLocaleString('ko-KR')}`,
  ];

  if (params.customerName?.trim()) {
    messageLines.push(`고객명: ${params.customerName.trim()}`);
  }

  return {
    subject: `[Locally Admin][결제] ${domainLabel} 결제 완료`,
    title: `${domainLabel} 결제가 완료되었습니다`,
    message: messageLines.join('\n'),
    link: params.link,
    ctaLabel: '결제 내역 확인하기',
  };
}
