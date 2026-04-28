import BookingCancelledEmail from '@/app/emails/templates/booking/BookingCancelledEmail';
import BookingConfirmedEmail from '@/app/emails/templates/booking/BookingConfirmedEmail';
import HostApplicationStatusEmail from '@/app/emails/templates/host/HostApplicationStatusEmail';
import InquiryNewMessageEmail from '@/app/emails/templates/inquiry/InquiryNewMessageEmail';
import NoticeEmail from '@/app/emails/templates/notice/NoticeEmail';
import ServicePaymentConfirmedEmail from '@/app/emails/templates/service/ServicePaymentConfirmedEmail';
import {
  buildBookingBankConfirmedHostTemplateProps,
  buildBookingCancelledTemplateProps,
  buildBookingConfirmedTemplateProps,
  buildHostApplicationStatusTemplateProps,
  buildInquiryNewMessageTemplateProps,
  buildNoticeCopyTemplateProps,
  buildNoticeCustomTemplateProps,
  buildReviewNewHostTemplateProps,
  buildServicePaymentConfirmedTemplateProps,
  buildServiceHostSelectedTemplateProps,
  buildServiceRequestNewHostTemplateProps,
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
  'booking.bank_confirmed_host': {
    component: BookingConfirmedEmail,
    buildProps: buildBookingBankConfirmedHostTemplateProps,
  },
  'inquiry.new_message': {
    component: InquiryNewMessageEmail,
    buildProps: buildInquiryNewMessageTemplateProps,
  },
  'host_application.status': {
    component: HostApplicationStatusEmail,
    buildProps: buildHostApplicationStatusTemplateProps,
  },
  'review.new_host': {
    component: BookingConfirmedEmail,
    buildProps: buildReviewNewHostTemplateProps,
  },
  'service.payment_confirmed': {
    component: ServicePaymentConfirmedEmail,
    buildProps: buildServicePaymentConfirmedTemplateProps,
  },
  'service.request_new_host': {
    component: ServicePaymentConfirmedEmail,
    buildProps: buildServiceRequestNewHostTemplateProps,
  },
  'service.host_selected': {
    component: ServicePaymentConfirmedEmail,
    buildProps: buildServiceHostSelectedTemplateProps,
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
