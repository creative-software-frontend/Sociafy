import type { Gift, GiftHistoryItem } from '../types/gift';
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
        if (!res.ok) return { error: json.message || `Request failed (${res.status})` };
        return { data: json as T };
    } catch {
        return { error: 'Network error' };
    }
}

export const giftApi = {
    getGifts: () => request<{ gifts: Gift[] }>('/gift/list'),
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
};
