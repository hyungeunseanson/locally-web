import * as React from 'react';
import {
  emailColors,
  EMAIL_FONT_STACK,
  emailTypography,
} from '@/app/emails/theme/tokens';

interface EmailKVRowProps {
  label: string;
  value: string;
  emphasis?: boolean;
  featured?: boolean;
  isLast?: boolean;
}

export default function EmailKVRow({
  label,
  value,
  emphasis = false,
  featured = false,
  isLast = false,
}: EmailKVRowProps) {
  if (featured) {
    return (
      <div className="locally-email-kv-featured" style={featuredRow}>
        <div style={labelStyle}>{label}</div>
        <div style={featuredValueStyle}>{renderValue(value)}</div>
      </div>
    );
  }

  const isStacked = value.includes('\n') || value.length > 22;
  if (isStacked) {
    return (
      <div className="locally-email-kv-row" style={{ ...stackedRow, ...(isLast ? lastRow : null) }}>
        <div style={labelStyle}>{label}</div>
        <div style={emphasis ? valueStrongStyle : stackedValueStyle}>{renderValue(value)}</div>
      </div>
    );
  }

  return (
    <div className="locally-email-kv-row" style={{ ...row, ...(isLast ? lastRow : null) }}>
      <span style={labelColumn}>
        <span style={labelStyle}>{label}</span>
      </span>
      <span style={valueColumn}>
        <span style={emphasis ? valueStrongStyle : valueStyle}>{renderValue(value)}</span>
      </span>
    </div>
  );
}

function renderValue(value: string) {
  const lines = value.split('\n');

  return lines.map((line, index) => (
    <React.Fragment key={`${line}-${index}`}>
      {index > 0 ? <br /> : null}
      {line}
    </React.Fragment>
  ));
}

const row = {
  borderBottom: `1px solid ${emailColors.rowBorder}`,
  fontSize: '0',
  lineHeight: '0',
  margin: '0',
  padding: '7px 0',
};

const lastRow = {
  borderBottom: '0',
};

const stackedRow = {
  ...row,
  padding: '10px 0',
};

const featuredRow = {
  borderBottom: `1px solid ${emailColors.rowBorder}`,
  fontSize: '0',
  lineHeight: '0',
  margin: '0 0 2px',
  padding: '0 0 9px',
};

const labelColumn = {
  display: 'inline-block',
  width: '42%',
  verticalAlign: 'middle' as const,
};

const valueColumn = {
  display: 'inline-block',
  textAlign: 'right' as const,
  verticalAlign: 'middle' as const,
  width: '58%',
};

const labelStyle = {
  color: emailColors.mutedText,
  fontFamily: EMAIL_FONT_STACK,
  fontSize: emailTypography.label,
  fontWeight: '600',
  lineHeight: '1.35',
  margin: '0',
  textAlign: 'left' as const,
};

const valueStyle = {
  color: emailColors.strongText,
  fontFamily: EMAIL_FONT_STACK,
  fontSize: '13px',
  fontWeight: 650,
  lineHeight: '1.45',
  margin: '0',
  textAlign: 'right' as const,
};

const stackedValueStyle = {
  ...valueStyle,
  marginTop: '5px',
  textAlign: 'left' as const,
};

const featuredValueStyle = {
  ...stackedValueStyle,
  fontSize: '15px',
  fontWeight: 750,
  lineHeight: '1.42',
};

const valueStrongStyle = {
  ...valueStyle,
  color: emailColors.strongText,
  fontWeight: '700',
  fontSize: '14px',
};
