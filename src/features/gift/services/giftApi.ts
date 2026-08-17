import type { Gift, GiftAsset, GiftHistoryItem } from '../types/gift';
import { API_URL } from '../../../config/apiConfig';

const BASE_URL = API_URL;

async function request<T>(path: string, options: RequestInit = {}): Promise<{ data?: T; error?: string }> {
    const token = localStorage.getItem('bluedise_token');
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    try {
        const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
        const json = await res.json();
        if (res.status === 429) return { error: 'Too many requests. Please try again later.' };
        if (!res.ok) return { error: json.message || `Request failed (${res.status})` };
        return { data: json as T };
    } catch {
        return { error: 'Network error' };
    }
}

async function requestMultipart<T>(path: string, formData: FormData): Promise<{ data?: T; error?: string }> {
    const token = localStorage.getItem('bluedise_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    try {
        const res = await fetch(`${BASE_URL}${path}`, { method: 'POST', headers, body: formData });
        const json = await res.json();
        if (res.status === 429) return { error: 'Too many requests. Please try again later.' };
        if (!res.ok) return { error: json.message || `Request failed (${res.status})` };
        return { data: json as T };
    } catch {
        return { error: 'Network error' };
    }
}

export const giftApi = {
    getGifts: () => request<{ gifts: Gift[] }>('/gift/list'),
    getAssets: () => request<{ assets: GiftAsset[] }>('/gift/assets'),
    sendGift: (receiver_id: number, gift_id: number) =>
        request<{ message: string }>('/gift/send', {
            method: 'POST',
            body: JSON.stringify({ receiver_id, gift_id }),
        }),
    getGiftHistory: () => request<{ history: GiftHistoryItem[] }>('/gift/history'),
};

export const adminGiftApi = {
    getGifts: () => request<{ gifts: Gift[] }>('/admin/gifts'),
    createGift: (payload: Partial<Gift>) =>
        request<{ gift: Gift }>('/admin/gifts', { method: 'POST', body: JSON.stringify(payload) }),
    updateGift: (id: number, payload: Partial<Gift>) =>
        request<{ gift: Gift }>(`/admin/gifts/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    toggleGift: (id: number, is_active: boolean) =>
        request<{ gift: Gift }>(`/admin/gifts/${id}/toggle`, { method: 'PATCH', body: JSON.stringify({ is_active }) }),
    deleteGift: (id: number) =>
        request<{ message: string }>(`/admin/gifts/${id}`, { method: 'DELETE' }),

    // ── Gift Asset Library (admin only) ──
    getAssets: () => request<{ assets: GiftAsset[] }>('/admin/gifts/assets'),
    createAsset: (file: File, name: string) => {
        const form = new FormData();
        form.append('image', file);
        form.append('name', name);
        return requestMultipart<{ asset: GiftAsset }>('/admin/gifts/assets', form);
    },
    updateAsset: (id: number, payload: { name?: string; is_active?: boolean }) =>
        request<{ asset: GiftAsset }>(`/admin/gifts/assets/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    deleteAsset: (id: number) =>
        request<{ message: string }>(`/admin/gifts/assets/${id}`, { method: 'DELETE' }),
};
