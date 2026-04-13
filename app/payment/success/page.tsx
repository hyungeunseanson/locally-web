import { notFound } from 'next/navigation';
import PaymentSuccessClient from './PaymentSuccessClient';

type SearchParamMap = { [key: string]: string | string[] | undefined };

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamMap>;
}) {
  const params = await searchParams;
  const orderIdParam = params?.orderId;
  const orderId = Array.isArray(orderIdParam) ? orderIdParam[0] : orderIdParam;

  // Legacy compatibility links still arrive with an orderId.
  // The bare route should no longer behave as a standalone public landing page.
  if (!orderId?.trim()) {
    notFound();
  }

  return <PaymentSuccessClient />;
}
