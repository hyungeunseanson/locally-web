import BookingCancelledEmail from '@/app/emails/templates/booking/BookingCancelledEmail';
import BookingConfirmedEmail from '@/app/emails/templates/booking/BookingConfirmedEmail';
import HostApplicationStatusEmail from '@/app/emails/templates/host/HostApplicationStatusEmail';
import InquiryNewMessageEmail from '@/app/emails/templates/inquiry/InquiryNewMessageEmail';
import NoticeEmail from '@/app/emails/templates/notice/NoticeEmail';
import ServicePaymentConfirmedEmail from '@/app/emails/templates/service/ServicePaymentConfirmedEmail';
import {
  buildBookingCancelledTemplateProps,
  buildBookingConfirmedTemplateProps,
  buildHostApplicationStatusTemplateProps,
  buildInquiryNewMessageTemplateProps,
  buildNoticeCopyTemplateProps,
  buildNoticeCustomTemplateProps,
  buildServicePaymentConfirmedTemplateProps,
} from './emailContentBuilders';
import type {
  EmailTemplateRegistration,
  EmailTemplateId,
} from './emailTypes';

export const emailTemplateRegistry: {
  [K in EmailTemplateId]: EmailTemplateRegistration<K>;
} = {
  'booking.confirmed': {
    component: BookingConfirmedEmail,
    buildProps: buildBookingConfirmedTemplateProps,
  },
  'booking.cancelled': {
    component: BookingCancelledEmail,
    buildProps: buildBookingCancelledTemplateProps,
  },
  'inquiry.new_message': {
    component: InquiryNewMessageEmail,
    buildProps: buildInquiryNewMessageTemplateProps,
  },
  'host_application.status': {
    component: HostApplicationStatusEmail,
    buildProps: buildHostApplicationStatusTemplateProps,
  },
  'service.payment_confirmed': {
    component: ServicePaymentConfirmedEmail,
    buildProps: buildServicePaymentConfirmedTemplateProps,
  },
  'notice.copy': {
    component: NoticeEmail,
    buildProps: buildNoticeCopyTemplateProps,
  },
  'notice.custom': {
    component: NoticeEmail,
    buildProps: buildNoticeCustomTemplateProps,
  },
};
