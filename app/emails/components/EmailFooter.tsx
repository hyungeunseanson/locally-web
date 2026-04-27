import { Link, Section, Text } from '@react-email/components';
import * as React from 'react';
import { buildAbsoluteUrl } from '@/app/utils/siteUrl';
import type { EmailLocale } from '@/app/emails/registry/emailTypes';
import type { EmailFooterVariant } from '@/app/emails/theme/variants';
import {
  emailColors,
  EMAIL_FONT_STACK,
  emailTypography,
} from '@/app/emails/theme/tokens';

interface EmailFooterProps {
  variant?: EmailFooterVariant;
  locale: EmailLocale;
}

export default function EmailFooter({
  variant = 'transactional',
  locale,
}: EmailFooterProps) {
  const copy = buildFooterCopy(locale, variant);

  if (variant === 'opsAdmin') {
    return (
      <Section className="locally-email-footer" style={footerSection} data-skip-in-text="true">
        <Text style={metaText}>{copy.heading}</Text>
        <Text style={legalText}>{copy.description}</Text>
        <Text style={finePrint}>{copy.finePrint}</Text>
      </Section>
    );
  }

  return (
    <Section className="locally-email-footer" style={footerSection} data-skip-in-text="true">
      <Text style={metaText}>{copy.heading}</Text>
      <Text style={legalText}>{copy.description}</Text>
      <Text style={legalText}>
        {copy.supportLabel}{' '}
        <Link href="mailto:locally.partners@gmail.com" style={link}>locally.partners@gmail.com</Link>
      </Text>
      <Text style={legalText}>
        <Link href={buildAbsoluteUrl('/privacy')} style={link}>Privacy</Link>
        {' · '}
        <Link href={buildAbsoluteUrl('/terms')} style={link}>Terms</Link>
      </Text>
      <Text style={finePrint}>{copy.address}</Text>
      <Text style={finePrint}>{copy.finePrint}</Text>
    </Section>
  );
}

function buildFooterCopy(locale: EmailLocale, variant: EmailFooterVariant) {
  if (variant === 'opsAdmin') {
    switch (locale) {
      case 'en':
        return {
          heading: 'Locally operations update',
          description: 'This email was sent for an operations task or internal follow-up. Please review the related item in the admin dashboard.',
          finePrint: 'Internal operations email from Locally',
        };
      case 'ja':
        return {
          heading: 'Locally 運営アップデート',
          description: 'このメールは運営対応や内部フォローのために送信されました。詳細は管理ダッシュボードでご確認ください。',
          finePrint: 'Locally 運営向け内部通知メール',
        };
      case 'zh':
        return {
          heading: 'Locally 运营更新',
          description: '此邮件用于运营处理或内部跟进提醒，请在管理后台中查看相关内容。',
          finePrint: 'Locally 内部运营通知邮件',
        };
      case 'ko':
      default:
        return {
          heading: 'Locally 운영 업데이트',
          description: '운영 처리나 내부 후속 확인이 필요한 항목을 안내드리는 메일입니다. 자세한 내용은 운영 대시보드에서 확인해 주세요.',
          finePrint: 'Locally 내부 운영 안내 메일',
        };
    }
  }

  switch (locale) {
    case 'en':
      return {
        heading: 'Locally booking and hosting update',
        description: 'This email was sent because there is an update to your booking, hosting, or service activity.',
        supportLabel: 'Support',
        address: '2F #31, 16 Dongmun-ro, Ildo 1-dong, Jeju-si, Jeju Special Self-Governing Province, South Korea',
        finePrint: '© 2026 Locally. Transactional email for product activity updates.',
      };
    case 'ja':
      return {
        heading: 'Locally ご案内',
        description: 'このメールは予約・ホスティング・サービス進行に関する更新をお知らせするために送信されました。',
        supportLabel: 'サポート',
        address: '韓国済州特別自治道 済州市 一徒1洞 東門路16 2F #31',
        finePrint: '© 2026 Locally. ご利用状況に関する取引メールです。',
      };
    case 'zh':
      return {
        heading: 'Locally 通知',
        description: '此邮件用于通知你的预订、接待或服务进展更新。',
        supportLabel: '支持',
        address: '韩国济州特别自治道 济州市 一徒1洞 东门路16 2楼 #31',
        finePrint: '© 2026 Locally. 这是一封与你的产品活动相关的交易通知邮件。',
      };
    case 'ko':
    default:
      return {
        heading: 'Locally 안내',
        description: '예약, 호스팅, 서비스 진행 상태에 변경이 있어 안내드립니다.',
        supportLabel: '문의',
        address: '제주특별자치도 제주시 일도1동 동문로 16, 2F #31',
        finePrint: '© 2026 Locally. 서비스 이용 상태 변경에 따라 발송되는 거래성 안내 메일입니다.',
      };
  }
}

const footerSection = {
  padding: '20px 20px 28px',
  textAlign: 'left' as const,
};

const metaText = {
  color: emailColors.strongText,
  fontFamily: EMAIL_FONT_STACK,
  fontSize: emailTypography.footer,
  fontWeight: '700',
  margin: '0 0 8px',
};

const legalText = {
  color: emailColors.mutedText,
  fontFamily: EMAIL_FONT_STACK,
  fontSize: emailTypography.footer,
  lineHeight: '1.7',
  margin: '0 0 5px',
};

const finePrint = {
  color: emailColors.softText,
  fontFamily: EMAIL_FONT_STACK,
  fontSize: emailTypography.footer,
  lineHeight: '1.7',
  margin: '4px 0 0',
};

const link = {
  color: emailColors.mutedText,
  textDecoration: 'underline',
};
