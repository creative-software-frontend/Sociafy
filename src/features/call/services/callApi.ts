export interface CallLog {
    id: number;
    caller_id: number;
    callee_id: number;
    status: string;
    call_type: 'audio' | 'video';
    started_at: string | null;
    ended_at: string | null;
    duration_seconds: number | null;
    ended_by: number | null;
    cost?: number;
    caller_cost?: number;
    receiver_cost?: number;
    created_at: string;
    caller_name: string;
    callee_name: string;
}

export interface CallHistoryResponse {
    calls: CallLog[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

import { API_URL } from '../../../config/apiConfig';

const BASE_URL = API_URL;

async function request<T>(path: string): Promise<{ data?: T; error?: string }> {
    const token = localStorage.getItem('bluedise_token');
    try {
        const res = await fetch(`${BASE_URL}${path}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const json = await res.json();
        if (res.status === 429) return { error: 'Too many requests. Please try again later.' };
        if (!res.ok) return { error: json.message || `Request failed (${res.status})` };
        return { data: json as T };
    } catch {
        return { error: 'Network error' };
    }
}

export const callApi = {
    getHistory: (query = '') => request<CallHistoryResponse>(`/call/history${query ? '?' + query : ''}`),
    getCall: (id: number) => request<{ call: CallLog }>(`/call/${id}`),
    getCallRate: () => request<{ call_rate_per_minute: number; call_rate_per_second: number }>('/call/rate'),
};
