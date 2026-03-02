import { Button } from '@react-email/components';
import * as React from 'react';

interface CTAButtonProps {
    href: string;
    children: React.ReactNode;
}

export default function CTAButton({ href, children }: CTAButtonProps) {
    return (
        <Button href={href} style={buttonStyle}>
            {children}
        </Button>
    );
}

const buttonStyle = {
    backgroundColor: '#000000',
    borderRadius: '12px',      // 둥글게, Airbnb 스타일
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: 'bold',
    textDecoration: 'none',
    textAlign: 'center' as const,
    display: 'inline-block',
    width: '100%',
    padding: '16px 0',         // 큼직한 패딩
    marginTop: '24px',
    marginBottom: '24px',
};
