export type ProxyCategory = 'RESTAURANT' | 'TRANSPORT' | 'HOTEL' | 'LOST_AND_FOUND' | 'GENERAL';
export type ProxyStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type PaymentChannel = 'NAVER' | 'LOCALLY';
export type PaymentStatus = 'WAITING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
export type ProxyPaymentMethod = 'card' | 'bank';
export type RestaurantServiceOption = 'STANDARD' | 'ZERO_ONE_TWO_ZERO' | 'KUITEI';

export type ProxyFormData = Record<string, unknown> & {
    payment_method?: ProxyPaymentMethod | null;
    contact_name?: string | null;
    contact_phone?: string | null;
    service_fee_krw?: number | null;
    restaurant_service_option?: RestaurantServiceOption | null;
    linked_inquiry_id?: string | number | null;
};

export interface ProxyRequest {
    id: string;
    user_id: string;
    category: ProxyCategory;
    status: ProxyStatus;
    form_data: ProxyFormData;
    payment_channel: PaymentChannel;
    payment_status: PaymentStatus;
    naver_buyer_name: string | null;
    locally_order_id: string | null;
    agreed_to_terms: boolean;
    created_at: string;
    updated_at: string;
    linked_inquiry_id?: string | null;
    tid?: string | null;
    paid_at?: string | null;
    refunded_at?: string | null;

    // Relations
    profiles?: {
        full_name?: string | null;
        email?: string | null;
        avatar_url?: string | null;
        phone?: string | null;
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
        full_name?: string | null;
        avatar_url?: string | null;
    };
}
