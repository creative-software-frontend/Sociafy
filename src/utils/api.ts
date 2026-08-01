// Central API utility — all backend calls go through here
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface ApiResponse<T = unknown> {
    data?: T;
    error?: string;
    status: number;
}

async function request<T>(
    path: string,
    options: RequestInit = {}
): Promise<ApiResponse<T>> {
    const token = localStorage.getItem('bluedise_token');

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const res = await fetch(`${BASE_URL}${path}`, {
            ...options,
            headers,
            credentials: 'include',
        });

        const json = await res.json().catch(() => ({}));

        console.log('[membershipApi request]', { path, resOk: res.ok, status: res.status, json });

        if (!res.ok) {
            return {
                status: res.status,
                error: json.message || `Request failed (${res.status})`,
            };
        }

        return { status: res.status, data: json as T };
    } catch {
        return { status: 0, error: 'Network error — is the backend running?' };
    }
}

// ── Auth endpoints ────────────────────────────────────────────────────────────

export interface RegisterPayload {
    name: string;
    email: string;
    phone: string;
    password: string;
    role: 'user' | 'provider';
    privacyAccepted?: boolean;
}


export interface LoginPayload {
    email: string;
    password: string;
}

export interface AuthResponseData {
    id: number;
    name: string;
    email: string;
    role: 'admin' | 'user' | 'provider';
    token: string;
}

export const authApi = {
    register: (payload: RegisterPayload) =>
        request<AuthResponseData>('/auth/register', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),

    login: (payload: LoginPayload) =>
        request<AuthResponseData>('/auth/login', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
};

export type TransactionType =
    | 'deposit'
    | 'withdraw'
    | 'earning'
    | 'event_payment'
    | 'event_income'
    | 'membership_purchase'
    | 'audio_call';

export interface Transaction {
    id: number;
    type: TransactionType;
    amount: number;
    status: string;
    description: string;
    created_at: string;
}


export interface WalletResponse {
    balance: number;
    /** Retained for backward compatibility; providers no longer use a separate earnings wallet. */
    earnings: number;
    /** balance minus sum of all Pending withdrawal requests (single wallet for all roles) */
    available_balance: number;
    /** Retained for backward compatibility; equals `earnings` and is no longer provider-specific. */
    available_earnings: number;
    role: string;
    transactions: Transaction[];
}


export interface DepositRequestPayload {
    amount: number;
    method: 'bKash' | 'Nagad';
    trx_id: string;
    screenshot_url: string;
}

export interface WithdrawRequestPayload {
    amount: number;
    method: 'bKash' | 'Nagad';
    account_number: string;
}

export interface DepositRequestItem {
    id: number;
    user_id: number;
    amount: number;
    method: string;
    trx_id: string;
    screenshot_url: string;
    status: string;
    admin_note?: string | null;
    approved_by?: number | null;
    approved_at?: string | null;
    created_at: string;
}

export interface WithdrawRequestItem {
    id: number;
    user_id: number;
    amount: number;
    method: string;
    account_number: string;
    status: string;
    admin_note?: string | null;
    approved_by?: number | null;
    approved_at?: string | null;
    created_at: string;
}

// ── User endpoints ────────────────────────────────────────────────────────────
export interface UserProfile {
    id: number;
    name: string;
    email: string;
    phone: string;
    gender: string | null;
    date_of_birth: string | null;
    profession: string | null;
    education: string | null;
    location: string | null;
    bio: string | null;
    interests: string | null;
    relationship_goal: string | null;
    marital_status: string | null;
    avatar_url: string | null;
    role: 'admin' | 'user' | 'provider';
    created_at: string;
}

export interface UpdateUserProfilePayload {
    // editable fields only
    name?: string;
    phone?: string;
    gender?: string | null;
    date_of_birth?: string | null; // YYYY-MM-DD
    profession?: string | null;
    education?: string | null;
    location?: string | null;
    bio?: string | null;
    interests?: string | null;
    relationship_goal?: string | null;
    marital_status?: string | null;
    avatar_url?: string | null; // base64 data URL OR /uploads/.. URL
}

export interface PartnerSearchFilters {
    keyword?: string;
    gender?: string;
    ageMin?: number;
    ageMax?: number;
    profession?: string;
    education?: string;
    location?: string;
    relationship_goal?: string;
    marital_status?: string;
    interests?: string[]; // will be joined by backend as comma-separated
}

export interface PartnerSearchResponse {
    total: number;
    page: number;
    pageSize: number;
    results: Array<Pick<
        UserProfile,
        | 'id'
        | 'name'
        | 'gender'
        | 'date_of_birth'
        | 'profession'
        | 'education'
        | 'location'
        | 'relationship_goal'
        | 'marital_status'
        | 'interests'
        | 'avatar_url'
        | 'created_at'
    >>;
}

export type MatchRequestStatus = 'pending' | 'accepted' | 'rejected';

export interface MatchRequestItem {
    id: number;
    sender_id: number;
    receiver_id: number;
    status: MatchRequestStatus;
    created_at: string;
    name: string; // other user's name (sender or receiver depending on incoming/outgoing)
    avatar_url: string | null;
    gender: string | null;
    date_of_birth: string | null;
    profession: string | null;
    location: string | null;
    relationship_goal: string | null;
    interests: string | null;
}

export interface MatchRequestListResponse {
    incoming: MatchRequestItem[];
    outgoing: MatchRequestItem[];
}

export interface SendMatchRequestResponse {
    message: string;
}

// ── Partner Request (USER → PROVIDER) types ──────────────────────────────────
export type PartnerRequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export interface PartnerRequestItem {
    id: number;
    user_id: number;
    provider_id: number;
    status: PartnerRequestStatus;
    created_at: string;
    updated_at: string;
    // Requester (user) profile fields, joined for the provider inbox:
    name: string | null;
    avatar_url: string | null;
    gender: string | null;
    date_of_birth: string | null;
    location: string | null;
    profession: string | null;
    interests: string | null;
    bio: string | null;
}

export interface PartnerRequestListResponse {
    requests: PartnerRequestItem[];
}

export interface PartnerRequestStatusResponse {
    status: PartnerRequestStatus | null;
    request?: {
        id: number;
        status: PartnerRequestStatus;
        created_at: string;
        updated_at: string;
    } | null;
}

export interface SendPartnerRequestResponse {
    message: string;
    request_id: number;
    status: PartnerRequestStatus;
}

// ── User endpoints ────────────────────────────────────────────────────────────
export interface MembershipStatus {
    plan: string;
    expires_at: string | null;
    days_remaining: number;
    wallet_balance: number;
    features: {
        [key: string]: { enabled: boolean; available: boolean; message: string };
    };
}

export interface CurrentMembership {
    package: string;
    expires_at: string | null;
    features: string[];
    /** DB-driven display names for active features (from features.display_name). */
    features_display?: string[];
}

export const userApi = {

    getProfile: () => request<UserProfile>('/user/profile'),

    updateProfile: (payload: UpdateUserProfilePayload) =>
        request<UserProfile>('/user/profile', {
            method: 'PUT',
            body: JSON.stringify(payload),
        }),

    uploadImage: async (
        file: File,
        folder: "avatars" | "deposits" | "posts"
    ): Promise<ApiResponse<{ url: string }>> => {
        const token = localStorage.getItem('bluedise_token');

        const form = new FormData();
        form.append('folder', folder);
        form.append('image', file);

        try {
            const res = await fetch(`${BASE_URL.replace(/\/$/, '')}/upload/image`, {
                method: 'POST',
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                body: form,
                credentials: 'include',
            });

            const json = await res.json().catch(() => ({}));

            if (!res.ok) {
                return { status: res.status, error: json.message || json?.error || `Upload failed (${res.status})` };
            }

            return { status: res.status, data: json };
        } catch {
            return { status: 0, error: 'Network error — is the backend running?' };
        }
    },




    getWallet: () => request<WalletResponse>('/user-wallet/wallet'),

    getMembershipStatus: () => request<MembershipStatus>('/user/membership/status'),
    getCurrentMembership: () => request<CurrentMembership>('/user/membership/current'),

    buyMembership: (packageId: number) =>
        request<{ success: boolean; message: string; package_id: number }>('/user/membership/buy', {
            method: 'POST',
            body: JSON.stringify({ package_id: packageId }),
        }),

    cancelMembership: () =>
        request<{ message: string }>('/user/membership/cancel', {
            method: 'POST',
        }),


    depositRequest: (payload: DepositRequestPayload) =>
        request<DepositRequestItem>('/user/deposit', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),

    getDepositHistory: () => request<DepositRequestItem[]>('/user-wallet/deposit-history'),

    deposit: (payloadOrAmount: number | DepositRequestPayload) => {
        const payload = typeof payloadOrAmount === 'number'
            ? {
                amount: payloadOrAmount,
                method: 'bKash' as const,
                trx_id: `legacy-${Date.now()}`,
                screenshot_url: 'legacy-ui',
            }
            : payloadOrAmount;

        return request<DepositRequestItem>('/user/deposit', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },

    withdraw: (payloadOrAmount: number | WithdrawRequestPayload) => {
        const payload = typeof payloadOrAmount === 'number'
            ? {
                amount: payloadOrAmount,
                method: 'bKash' as const,
                account_number: 'legacy-ui',
            }
            : payloadOrAmount;

        return request<WithdrawRequestItem>('/user/withdraw', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },

    withdrawRequest: (payload: WithdrawRequestPayload) =>
        request<WithdrawRequestItem>('/user/withdraw', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),

    getWithdrawHistory: () => request<WithdrawRequestItem[]>('/user-wallet/withdraw-history'),

    searchPartners: (filters: PartnerSearchFilters & { page?: number; pageSize?: number }) => {
        const params = new URLSearchParams();

        if (filters.keyword) params.set('keyword', filters.keyword);
        if (filters.gender) params.set('gender', filters.gender);
        if (filters.ageMin !== undefined) params.set('ageMin', String(filters.ageMin));
        if (filters.ageMax !== undefined) params.set('ageMax', String(filters.ageMax));
        if (filters.profession) params.set('profession', filters.profession);
        if (filters.education) params.set('education', filters.education);
        if (filters.location) params.set('location', filters.location);
        if (filters.relationship_goal) params.set('relationship_goal', filters.relationship_goal);
        if (filters.marital_status) params.set('marital_status', filters.marital_status);
        if (filters.interests && filters.interests.length > 0) params.set('interests', filters.interests.join(','));
        if (filters.page !== undefined) params.set('page', String(filters.page));
        if (filters.pageSize !== undefined) params.set('pageSize', String(filters.pageSize));

        return request<PartnerSearchResponse>(`/user/search?${params.toString()}`);
    },

    getMatchRequests: () => request<MatchRequestListResponse>('/user/match-request'),

    sendMatchRequest: (receiverId: number) =>
        request<SendMatchRequestResponse>('/user/match-request', {
            method: 'POST',
            body: JSON.stringify({ receiver_id: receiverId }),
        }),

    acceptMatchRequest: (id: number) =>
        request<{ message: string; match_request_id: number }>(`/user/match-request/${id}/accept`, {
            method: 'POST',
        }),

    rejectMatchRequest: (id: number) =>
        request<{ message: string; match_request_id: number }>(`/user/match-request/${id}/reject`, {
            method: 'POST',
        }),

    // ── Partner Request (USER → PROVIDER) ──
    sendPartnerRequest: (providerId: number) =>
        request<SendPartnerRequestResponse>('/partner/request', {
            method: 'POST',
            body: JSON.stringify({ provider_id: providerId }),
        }),

    getPartnerRequestStatus: (providerId: number) =>
        request<PartnerRequestStatusResponse>(`/partner/status/${providerId}`),

    // View a provider's profile (public until request accepted, then full).
    getPartnerProfile: (providerId: number) =>
        request<{ profile: UserProfile; access: 'public' | 'full'; partner_status: PartnerRequestStatus | null }>(
            `/partner/profile/${providerId}`
        ),

    // ── User dashboard dynamic data ──
    getProviders: () =>
        request<Array<{
            id: number;
            name: string;
            avatar_url: string | null;
            profession: string | null;
            location: string | null;
            interests: string | null;
            date_of_birth: string | null;
        }>>('/user/providers'),

    getEventLocations: () =>
        request<Array<{
            location: string;
            event_count: number;
            next_event: string | null;
        }>>('/user/event-locations'),

    getJoinedEvents: () =>
        request<Array<{
            id: number;
            title: string;
            description: string | null;
            date_time: string;
            location: string;
            capacity: number;
            status: string;
            host_name: string | null;
            entry_fee: number;
            created_at: string;
            participant_count: number;
        }>>('/user/joined-events'),

    getRecentActivity: () =>
        request<Array<{
            type: 'event_join' | 'friend_added';
            id: number;
            status: string;
            created_at: string;
            detail: string | null;
            extra: string | null;
            counterpart_name: string;
            counterpart_avatar: string | null;
        }>>('/user/recent-activity'),

    getFeaturedProviders: () =>
        request<Array<{
            id: number;
            name: string;
            avatar_url: string | null;
            location: string | null;
            date_of_birth: string | null;
            profession: string | null;
            membership_package: string | null;
        }>>('/user/featured-providers'),

    // ── Change Password ──
    changePassword: (payload: ChangePasswordPayload) =>
        request<ChangePasswordResponse>('/user/change-password', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
};

export interface ChangePasswordPayload {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
}

export interface ChangePasswordResponse {
    success: boolean;
    message: string;
}

// ── Provider Package type (normalized) ────────────────────────────────────────
export interface ProviderPackage {
    id: number;
    name: string;
    description: string | null;
    price: number;
    duration_days: number;
    duration_months: number;
    tier_type: string;
    type: 'provider';
    features: PackageFeature[];
}

// ── Provider endpoints ────────────────────────────────────────────────────────
export const providerApi = {
    getDashboard: () => request<{ message: string }>('/provider/dashboard'),
    getOnlineProviders: () =>
        request<Array<{ id: number; name: string; last_seen: string | null; is_online: number }>>(
            '/provider/online-providers'
        ),
    getOnlineUsers: () =>
        request<Array<{ id: number; name: string; last_seen: string | null; is_online: number }>>(
            '/provider/online-users'
        ),
    getProviderPackages: () =>
        request<ProviderPackage[]>('/provider/packages'),

    // ── Partner Requests inbox (PROVIDER) ──
    getPartnerRequests: () =>
        request<PartnerRequestListResponse>('/provider/partner-requests'),

    acceptPartnerRequest: (id: number) =>
        request<{ message: string; request_id: number; status: PartnerRequestStatus }>(
            `/provider/partner-request/${id}/accept`,
            { method: 'POST' }
        ),

    rejectPartnerRequest: (id: number) =>
        request<{ message: string; request_id: number; status: PartnerRequestStatus }>(
            `/provider/partner-request/${id}/reject`,
            { method: 'POST' }
        ),

    // View a requester's (user) profile (public until request accepted, then full).
    getRequesterProfile: (userId: number) =>
        request<{ profile: UserProfile; access: 'public' | 'full'; partner_status: PartnerRequestStatus | null }>(
            `/provider/requester-profile/${userId}`
        ),

    // ── Dashboard home dynamic data (PROVIDER) ──
    getFeaturedProfiles: () =>
        request<Array<{
            id: number;
            name: string;
            avatar_url: string | null;
            profession: string | null;
            location: string | null;
            interests: string | null;
        }>>('/provider/featured-profiles'),

    getFeaturedLocations: () =>
        request<Array<{
            location: string;
            event_count: number;
            next_event: string | null;
        }>>('/provider/featured-locations'),

    getRecentActivity: () =>
        request<Array<{
            type: 'partner_request' | 'event_join' | 'message';
            id: number;
            status: string;
            created_at: string;
            counterpart_name: string;
            counterpart_avatar: string | null;
            detail: string | null;
        }>>('/provider/recent-activity'),

    getRecentEvents: () =>
        request<Array<{
            id: number;
            title: string;
            description: string | null;
            date_time: string;
            location: string;
            capacity: number;
            status: string;
            created_at: string;
            host_name: string | null;
            entry_fee: number;
        }>>('/provider/recent-events'),

    // ── Provider directory (Models quick-link) ──
    getProviders: () =>
        request<Array<{
            id: number;
            name: string;
            avatar_url: string | null;
            profession: string | null;
            location: string | null;
            interests: string | null;
        }>>('/provider/list'),

    // ── All events (Places quick-link) ──
    getAllEvents: () =>
        request<Array<{
            id: number;
            title: string;
            description: string | null;
            date_time: string;
            location: string;
            capacity: number;
            status: string;
            created_at: string;
            host_name: string | null;
            entry_fee: number;
            participant_count: number;
        }>>('/provider/all-events'),
};

// ── Membership catalogs (role isolation) ─────────────────────────────────
export const membershipApi = {
    getUserPackages: () => request<Package[]>('/user/membership/user-packages'),
    getProviderPackages: () => request<Package[]>('/user/membership/provider-packages'),
};


// ── Social / Service endpoints ─────────────────────────────────────────────────

export interface Post {
    id: number;
    content: string;
    image_url: string | null;
    created_at: string;
    user_id: number;
    author_name: string;
    author_role: string;
    like_count: number;
    comment_count: number;
    share_count: number;
    user_has_liked: boolean;
}

export interface PostComment {
    id: number;
    post_id: number;
    user_id: number;
    content: string;
    created_at: string;
    author_name: string;
    avatar_url: string | null;
}

export interface CommentsResponse {
    comments: PostComment[];
    total: number;
    page: number;
    limit: number;
}

export interface ChatMessage {
    id: number;
    sender_id: number;
    receiver_id: number;
    message: string;
    created_at: string;
    sender_name: string;
}

export interface ActiveUser {
    id: number;
    name: string;
    last_seen: string | null;
    is_online: number;
    request_status?: 'pending' | 'accepted' | 'rejected';
}

export const serviceApi = {
    getPosts: () => request<Post[]>('/provider/posts'),
    createPost: (content: string, image_url?: string | null) =>
        request<Post>('/provider/posts', {
            method: 'POST',
            body: JSON.stringify({ content, image_url: image_url ?? null }),
        }),

    toggleLike: (postId: number) =>
        request<{ liked: boolean; likeCount: number }>(`/provider/posts/${postId}/like`, {
            method: 'POST',
        }),

    getComments: (postId: number, page = 1) =>
        request<CommentsResponse>(`/provider/posts/${postId}/comments?page=${page}&limit=10`),

    addComment: (postId: number, content: string) =>
        request<PostComment>(`/provider/posts/${postId}/comment`, {
            method: 'POST',
            body: JSON.stringify({ content }),
        }),

    sharePost: (postId: number) =>
        request<{ shareCount: number }>(`/provider/posts/${postId}/share`, {
            method: 'POST',
        }),

    getMessages: (partnerId: number) =>
        request<ChatMessage[]>(`/provider/messages?with=${partnerId}`),
    sendMessage: (receiver_id: number, message: string) =>
        request<{ id: number; sender_id: number; receiver_id: number; message: string }>(
            '/provider/messages',
            { method: 'POST', body: JSON.stringify({ receiver_id, message }) }
        ),
    getActiveProviders: () =>
        request<ActiveUser[]>('/provider/active-providers'),
};
// ── Admin endpoints ────────────────────────────────────────────────────────────

export interface UserInfo {
    id: number;
    name: string;
    email: string;
    phone: string;
    role: string;
    is_active: number;
    created_at: string;
}

export interface UsersSummaryData {
    totalUsers: number;
    totalProviders: number;
    users: UserInfo[];
    providers: UserInfo[];
}

export interface PackageFeature {
    id: number;
    key: string;
    display_name: string;
    is_coming_soon?: boolean;
}

export interface Package {
    id: number;
    name: string;
    description: string;
    price: number;
    duration_days: number;
    duration_months: number;
    tier_type: string;
    membership_level: number; // DB-driven hierarchy level (Silver=1, Gold=2, Platinum=3)
    type: 'user' | 'provider';
    features: PackageFeature[] | string; // normalized array from API, or legacy CSV string
    is_active: number;
    created_at: string;
}

export interface Feature {
    id: number;
    feature_key: string;
    display_name: string;
    scope?: 'user' | 'provider' | 'both' | string;
    is_coming_soon?: number;
}

export interface CreatePackagePayload {
    name: string;
    description: string;
    price: number;
    duration_days: number;
    duration_months: number;
    tier_type: string;
    membership_level: number; // DB-driven hierarchy level
    type: 'user' | 'provider';
    feature_ids: number[];
    features?: string; // legacy CSV kept for user membership status service
}

export interface PlatformRate {
    id: number;
    rate_key: string;
    rate_value: number;
    label: string;
    updated_at: string;
}

export interface LedgerEntry {
    id: number;
    type: 'deposit' | 'withdraw' | 'earning';
    amount: number;
    status: string;
    description: string;
    created_at: string;
    user_id: number;
    user_name: string;
    user_role: string;
}

export interface TopAccount {
    id: number;
    name: string;
    role: string;
    total_deposited?: number;
    total_earned?: number;
}

export interface ReportsData {
    stats: {
        totalDeposits: number;
        totalWithdrawals: number;
        totalEarnings: number;
        netHoldings: number;
        totalUsers: number;
        totalProviders: number;
    };
    topDepositors: TopAccount[];
    topEarners: TopAccount[];
    ledger: LedgerEntry[];
}

export interface PendingWalletRequestsResponse {
    deposits: Array<DepositRequestItem & { user_name?: string; user_email?: string }>;
    withdrawals: Array<WithdrawRequestItem & { user_name?: string; user_email?: string }>;
}

export const adminApi = {
    getUsersSummary: () =>
        request<UsersSummaryData>('/admin/users-summary'),

    getPublicPackages: () =>
        request<Package[]>('/admin/packages/public'),

    getPackages: () =>
        request<Package[]>('/admin/packages'),

    getFeatures: () =>
        request<Feature[]>('/admin/features'),

    createPackage: (payload: CreatePackagePayload) =>
        request<{ id: number }>('/admin/packages', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),

    updatePackage: (id: number, payload: Partial<CreatePackagePayload>) =>
        request<{ message: string }>(`/admin/packages/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
        }),

    deletePackage: (id: number) =>
        request<{ message: string }>(`/admin/packages/${id}`, { method: 'DELETE' }),

    getRates: () =>
        request<PlatformRate[]>('/admin/rates'),

    updateRate: (key: string, rate_value: number) =>
        request<{ message: string; rate_key: string; rate_value: number }>(
            `/admin/rates/${key}`,
            { method: 'PUT', body: JSON.stringify({ rate_value }) }
        ),

    getPlatformSettings: () =>
        request<{ call_rate_per_minute: number; call_rate_per_second: number }>('/admin/platform-settings'),

    updatePlatformSettings: (call_rate_per_minute: number) =>
        request<{ call_rate_per_minute: number; call_rate_per_second: number }>('/admin/platform-settings', {
            method: 'PUT',
            body: JSON.stringify({ call_rate_per_minute }),
        }),

    toggleUserActive: (id: number) =>
        request<{ message: string; is_active: number }>(
            `/admin/users/${id}/toggle-active`,
            { method: 'PUT' }
        ),

    getReports: () =>
        request<ReportsData>('/admin/reports'),

    getPendingWalletRequests: async () => {
        const [depositRes, withdrawRes] = await Promise.all([
            request<DepositRequestItem[]>('/admin-wallet/deposit-requests'),
            request<WithdrawRequestItem[]>('/admin-wallet/withdraw-requests'),
        ]);

        return {
            status: 200,
            data: {
                deposits: (depositRes.data || []).filter((item) => item.status === 'Pending'),
                withdrawals: (withdrawRes.data || []).filter((item) => item.status === 'Pending'),
            },
        } as ApiResponse<PendingWalletRequestsResponse>;
    },

    approveDepositRequest: (id: number, adminNote = '') =>
        request<DepositRequestItem>(`/admin-wallet/deposit/${id}/approve`, {
            method: 'PATCH',
            body: JSON.stringify({ admin_note: adminNote }),
        }),

    rejectDepositRequest: (id: number, adminNote = '') =>
        request<DepositRequestItem>(`/admin-wallet/deposit/${id}/reject`, {
            method: 'PATCH',
            body: JSON.stringify({ admin_note: adminNote }),
        }),

    approveWithdrawRequest: (id: number, adminNote = '') =>
        request<WithdrawRequestItem>(`/admin-wallet/withdraw/${id}/approve`, {
            method: 'PATCH',
            body: JSON.stringify({ admin_note: adminNote }),
        }),

    rejectWithdrawRequest: (id: number, adminNote = '') =>
        request<WithdrawRequestItem>(`/admin-wallet/withdraw/${id}/reject`, {
            method: 'PATCH',
            body: JSON.stringify({ admin_note: adminNote }),
        }),

    // ── Admin Wallet (platform revenue) ──
    getAdminWallet: () =>
        request<{
            balance: number;
            totalMembershipIncome: number;
            totalCallIncome: number;
            totalWithdrawals: number;
            transactions: AdminWalletTransaction[];
        }>('/admin/wallet'),

    getAdminWalletTransactions: () =>
        request<{ transactions: AdminWalletTransaction[] }>('/admin/wallet/transactions'),

    withdrawAdminWallet: (payload: { amount: number; method: string; trx_id: string }) =>
        request<{ success: boolean; amount: number }>('/admin/wallet/withdraw', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
};

export interface AdminWalletTransaction {
    id: number;
    type: string;
    amount: number;
    description: string | null;
    reference_id: number | null;
    created_at: string;
}

// ── Event endpoints ────────────────────────────────────────────────────────────

export interface Event {
    id: number;
    title: string;
    description: string | null;
    date_time: string;
    location: string;
    capacity: number;
    creator_id: number;
    creator_name?: string;
    host_name?: string | null;
    entry_fee?: number | null;
    application_deadline?: string | null;
    status: 'active' | 'cancelled' | 'completed';
    created_at: string;
    participant_count: number;
    joined?: number; // 1 or 0
}


export interface EventParticipant {
    id: number;
    name: string;
    email: string;
    joined_at: string;
}

export const eventApi = {
    getEvents: (role: string) =>
        request<Event[]>(`/${role}/events`),

    // Provider "Browse Events" — DB-driven feature gate (provider_browse_events)
    getProviderBrowseEvents: () =>
        request<Event[]>('/provider/events'),

    // Provider "My Events" — DB-driven feature gate (provider_my_events)
    getProviderMyEvents: () =>
        request<Event[]>('/provider/events/mine'),

    createEvent: (payload: { title: string; description: string; date_time: string; location: string; capacity: number; host_name: string; entry_fee: number; application_deadline: string }) =>
        request<Event>('/provider/events', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),

    updateEvent: (id: number, payload: { title: string; description: string; date_time: string; location: string; capacity: number; status: string; host_name: string; entry_fee: number; application_deadline: string }) =>
        request<Event>(`/provider/events/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
        }),

    deleteEvent: (id: number) =>
        request<{ message: string }>(`/provider/events/${id}`, {
            method: 'DELETE',
        }),

    joinEvent: (id: number) =>
        request<{ message: string }>(`/user/events/${id}/join`, {
            method: 'POST',
        }),

    leaveEvent: (id: number) =>
        request<{ message: string }>(`/user/events/${id}/leave`, {
            method: 'POST',
        }),

    getParticipants: (id: number) =>
        request<EventParticipant[]>(`/provider/events/${id}/participants`),
};