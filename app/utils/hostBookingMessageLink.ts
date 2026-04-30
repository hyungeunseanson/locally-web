import { getHostDashboardHref } from '@/app/host/dashboard/navigation';

export function getHostBookingMessageHref(params: {
  guestId?: string | number | null;
  experienceId?: string | number | null;
}) {
  if (!params.guestId || !params.experienceId) {
    return getHostDashboardHref('reservations');
  }

  return getHostDashboardHref('inquiries', {
    guestId: params.guestId,
    expId: params.experienceId,
  });
}
