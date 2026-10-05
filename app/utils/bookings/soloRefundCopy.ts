import type { NotificationLocale } from '@/app/utils/notificationLocale';

export function soloRefundNotificationCopy(locale: NotificationLocale, applied: boolean, amount: number, host = false) {
  const value = `₩${amount.toLocaleString('en-US')}`;
  const copy = {
    ko: { title: applied ? '1인 진행 추가금 환불 완료' : '1인 진행 추가금 환불 확인 중',
      message: applied ? `투어 종료 시 다른 참여자가 확인되어 예약 당시 추가금 ${value}이 환불되었습니다.` : `투어 종료 시 다른 참여자가 확인되어 예약 당시 추가금 ${value}의 외부 환불을 확인 중입니다.`,
      host: `예약 당시 1인 진행 추가금 ${value} 환불에 따른 정산 조정입니다.` },
    en: { title: applied ? 'Solo guarantee add-on refunded' : 'Solo guarantee refund pending',
      message: applied ? `Another participant qualified at the tour end boundary. Your booking-time add-on of ${value} was refunded.` : `Another participant qualified at the tour end boundary. We are confirming the external refund of your ${value} booking-time add-on.`,
      host: `This payout adjustment reflects the refund of the ${value} booking-time solo guarantee add-on.` },
    ja: { title: applied ? '1名催行追加料金の返金完了' : '1名催行追加料金の返金確認中',
      message: applied ? `ツアー終了時に他の参加者が確認されたため、予約時の追加料金${value}を返金しました。` : `ツアー終了時に他の参加者が確認されたため、予約時の追加料金${value}の返金を確認中です。`,
      host: `予約時の1名催行追加料金${value}の返金に伴う精算調整です。` },
    zh: { title: applied ? '单人成行附加费已退款' : '单人成行附加费退款确认中',
      message: applied ? `行程结束时确认有其他合格参与者，已退还预订时的附加费${value}。` : `行程结束时确认有其他合格参与者，正在确认预订时附加费${value}的退款。`,
      host: `此结算调整对应预订时单人成行附加费${value}的退款。` },
  }[locale];
  return { title: copy.title, message: host ? copy.host : copy.message };
}
