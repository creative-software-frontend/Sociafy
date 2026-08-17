export interface GiftAsset {
    id: number;
    name: string;
    asset_type: string; // gif | png | jpg | webp
    url: string;
    storage_key?: string | null;
    is_active: number;
    created_at?: string;
    updated_at?: string;
}

export interface Gift {
    id: number;
    name: string;
    icon: string | null;
    image: string | null;
    price: number;
    provider_percentage: number;
    admin_percentage: number;
    is_active: number;
    asset_id?: number | null;
    asset?: GiftAsset | null;
    created_at?: string;
    updated_at?: string;
}

export interface GiftHistoryItem {
    id: number;
    sender_id: number;
    receiver_id: number;
    gift_id: number;
    gift_price: number;
    provider_amount: number;
    admin_amount: number;
    message_id: number | null;
    created_at: string;
    gift_name: string;
    gift_icon: string | null;
    gift_asset_url?: string | null;
    gift_asset_type?: string | null;
    sender_name: string;
    receiver_name: string;
}

export interface GiftMessageData {
    gift: boolean;
    giftId: number;
    giftName: string;
    icon: string;
    image?: string | null;
    price: number;
}

export function parseGiftMessage(raw: string): GiftMessageData | null {
    if (!raw || typeof raw !== 'string' || !raw.startsWith('{"gift"')) return null;
    try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.gift === true) return parsed as GiftMessageData;
    } catch {
        return null;
    }
    return null;
}
