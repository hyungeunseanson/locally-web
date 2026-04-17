import { handleNicePayCardNotification } from '@/app/api/payment/cardNotificationHandler';

export async function POST(request: Request) {
  return handleNicePayCardNotification(request);
}
