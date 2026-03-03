export type ProxyCategory = 'RESTAURANT' | 'TRANSPORT' | 'HOTEL' | 'LOST_AND_FOUND' | 'GENERAL';
export type ProxyStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type PaymentChannel = 'NAVER' | 'LOCALLY';
export type PaymentStatus = 'WAITING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';

export interface ProxyRequest {
    id: string;
    user_id: string;
    category: ProxyCategory;
    status: ProxyStatus;
    form_data: Record<string, any>;
    payment_channel: PaymentChannel;
    payment_status: PaymentStatus;
    naver_buyer_name: string | null;
    locally_order_id: string | null;
    agreed_to_terms: boolean;
    created_at: string;
    updated_at: string;

    // Relations
    profiles?: {
        name: string;
        email: string;
        avatar_url: string;
    };
}

export interface ProxyComment {
    id: string;
    request_id: string;
    author_id: string;
    content: string;
    is_admin: boolean;
    created_at: string;
    updated_at: string;

    // Relations
    profiles?: {
        name: string;
        avatar_url: string;
    };
}
