import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    adminApi,
    type PendingWalletRequestsResponse,
    type ReportsData,
    type UsersSummaryData,
    type AdminWalletTransaction,
} from '../../../../../utils/api';
import { useAuth } from '../../../../../context/AuthContext';
import { useToast } from '../../../../../components/Toast';
import { PointsDisplay } from '../../../../../components/PointsDisplay';

interface AdminWalletData {
    balance: number;
    totalMembershipIncome: number;
    totalCallIncome: number;
    totalWithdrawals: number;
    transactions: AdminWalletTransaction[];
}

interface LoadFns {
    users: boolean;
    reports: boolean;
    wallet: boolean;
    pending: boolean;
}

const LEDGER_TYPE: Record<string, { label: string; color: string; bg: string }> = {
    deposit: { label: 'Deposit', color: 'var(--green-status)', bg: 'rgba(16,185,129,0.12)' },
    withdraw: { label: 'Withdraw', color: 'var(--gold-mid)', bg: 'rgba(197,168,128,0.12)' },
    earning: { label: 'Earning', color: 'var(--blue-vivid)', bg: 'rgba(59,130,246,0.12)' },
    event_payment: { label: 'Event Payment', color: 'var(--red-status)', bg: 'rgba(239,68,68,0.12)' },
    event_income: { label: 'Event Income', color: 'var(--blue-vivid)', bg: 'rgba(59,130,246,0.12)' },
    membership_purchase: { label: 'Membership', color: 'var(--gold-mid)', bg: 'rgba(197,168,128,0.12)' },
    audio_call: { label: 'Audio Call', color: 'var(--blue-vivid)', bg: 'rgba(59,130,246,0.12)' },
};

function shortTime(d: string): string {
    const t = new Date(d);
    if (Number.isNaN(t.getTime())) return '';
    const diff = Math.max(0, Date.now() - t.getTime());
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return t.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function sectionHeader(icon: React.ReactNode, title: string, action?: React.ReactNode) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{ color: 'var(--blue-vivid)', display: 'flex', flexShrink: 0 }}>{icon}</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter', sans-serif", flex: 1 }}>
                {title}
            </span>
            {action}
        </div>
    );
}

const pendingArrow = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" />
    </svg>
);

const walletIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7h18v10H3z" /><path d="M16 11h.01" />
    </svg>
);

const usersIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
);

const activityIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
);

const boltIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
);

export function AdminHome() {
    const { role } = useParams<{ role: string }>();
    const { user } = useAuth();
    const toast = useToast();
    const navigate = useNavigate();

    const basePath = `/${role}/dashboard`;

    const [usersData, setUsersData] = useState<UsersSummaryData | null>(null);
    const [reportsData, setReportsData] = useState<ReportsData | null>(null);
    const [walletData, setWalletData] = useState<AdminWalletData | null>(null);
    const [pending, setPending] = useState<PendingWalletRequestsResponse>({ deposits: [], withdrawals: [] });
    const [loading, setLoading] = useState<LoadFns>({ users: true, reports: true, wallet: true, pending: true });
    const [apiError, setApiError] = useState<string | null>(null);
    const [busyKey, setBusyKey] = useState<string | null>(null);

    const loadUsers = () => {
        adminApi.getUsersSummary()
            .then(r => { if (r.data) setUsersData(r.data); else if (r.error) setApiError(r.error); })
            .catch(() => setApiError('Failed to load users'))
            .finally(() => setLoading(l => ({ ...l, users: false })));
    };

    const loadReports = () => {
        adminApi.getReports()
            .then(r => { if (r.data) setReportsData(r.data); else if (r.error) setApiError(r.error); })
            .catch(() => setApiError('Failed to load reports'))
            .finally(() => setLoading(l => ({ ...l, reports: false })));
    };

    const loadWallet = () => {
        adminApi.getAdminWallet()
            .then(r => { if (r.data) setWalletData(r.data); else if (r.error) setApiError(r.error); })
            .catch(() => setApiError('Failed to load wallet'))
            .finally(() => setLoading(l => ({ ...l, wallet: false })));
    };

    const loadPending = () => {
        adminApi.getPendingWalletRequests()
            .then(r => { if (r.data) setPending(r.data); else if (r.error) setApiError(r.error); })
            .catch(() => setApiError('Failed to load pending requests'))
            .finally(() => setLoading(l => ({ ...l, pending: false })));
    };

    useEffect(() => {
        loadUsers();
        loadReports();
        loadWallet();
        loadPending();
    }, []);

    const handleRequestAction = async (kind: 'deposit' | 'withdraw', id: number, action: 'approve' | 'reject') => {
        setBusyKey(`${kind}-${id}`);
        const res = kind === 'deposit'
            ? (action === 'approve' ? await adminApi.approveDepositRequest(id) : await adminApi.rejectDepositRequest(id))
            : (action === 'approve' ? await adminApi.approveWithdrawRequest(id) : await adminApi.rejectWithdrawRequest(id));
        setBusyKey(null);
        if (res.error) {
            toast.error(res.error);
            return;
        }
        toast.success(`${kind === 'deposit' ? 'Deposit' : 'Withdrawal'} ${action === 'approve' ? 'approved' : 'rejected'}.`);
        loadPending();
        loadWallet();
        loadReports();
    };

    // Combined pending list (most recent first, capped at 5)
    const pendingItems = [
        ...pending.deposits.map(d => ({
            key: `deposit-${d.id}`,
            kind: 'deposit' as const,
            id: d.id,
            name: d.user_name || `User #${d.user_id}`,
            amount: d.amount,
            created_at: d.created_at,
        })),
        ...pending.withdrawals.map(w => ({
            key: `withdraw-${w.id}`,
            kind: 'withdraw' as const,
            id: w.id,
            name: w.user_name || `User #${w.user_id}`,
            amount: w.amount,
            created_at: w.created_at,
        })),
    ].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);

    // Active / inactive counts from users-summary
    const activeUsers = usersData ? usersData.users.filter(u => Number(u.is_active) === 1).length : 0;
    const inactiveUsers = usersData ? usersData.users.length - activeUsers : 0;
    const activeProviders = usersData ? usersData.providers.filter(p => Number(p.is_active) === 1).length : 0;
    const inactiveProviders = usersData ? usersData.providers.length - activeProviders : 0;

    // Recent registrations (newest users + providers)
    const recentRegistrations = usersData
        ? [...usersData.users.map(u => ({ name: u.name, role: 'user', created_at: u.created_at })),
           ...usersData.providers.map(p => ({ name: p.name, role: 'provider', created_at: p.created_at }))]
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .slice(0, 5)
        : [];

    const stats = reportsData?.stats;

    const quickActions = [
        { label: 'USERS', to: '/users', icon: usersIcon, color: 'var(--blue-vivid)', bg: 'rgba(59,130,246,0.1)' },
        { label: 'REPORTS', to: '/reports', icon: activityIcon, color: 'var(--green-status)', bg: 'rgba(16,185,129,0.1)' },
        { label: 'ADMIN WALLET', to: '/admin-wallet', icon: walletIcon, color: 'var(--gold-mid)', bg: 'rgba(197,168,128,0.12)' },
        { label: 'GIFTS', to: '/admin-gifts', icon: <span style={{ fontSize: '14px' }}>🎁</span>, color: 'var(--gold-mid)', bg: 'rgba(197,168,128,0.12)' },
        { label: 'PACKAGES', to: '/settings', icon: <span style={{ fontSize: '14px' }}>📦</span>, color: 'var(--blue-vivid)', bg: 'rgba(99,102,241,0.12)' },
        { label: 'PLATFORM SETTINGS', to: '/platform-settings', icon: <span style={{ fontSize: '14px' }}>⚙️</span>, color: 'var(--text-secondary)', bg: 'var(--bg-input)' },
    ];

    const kpiTile = (label: string, value: React.ReactNode, loading_: boolean, accent?: string) => (
        <div style={{
            background: 'linear-gradient(135deg, var(--bg-card-hover) 0%, var(--bg-card) 100%)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '14px 12px',
        }}>
            <p style={{
                fontSize: 'clamp(1.15rem, 5vw, 1.4rem)',
                fontWeight: 800,
                color: accent || 'var(--text-primary)',
                fontFamily: "'Inter', sans-serif",
                margin: 0,
                lineHeight: 1.1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
            }}>
                {loading_ ? '…' : value}
            </p>
            <p style={{
                fontSize: '0.55rem',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                fontFamily: "'Inter', sans-serif",
                fontWeight: 700,
                margin: '6px 0 0',
            }}>
                {label}
            </p>
        </div>
    );

    const modernDate = new Date().toLocaleDateString(undefined, {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* ── 1. Admin header ── */}
            <div className="card gold-top-edge" style={{ padding: 'clamp(14px, 4vw, 18px)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold-mid)', fontWeight: 800, fontFamily: "'Inter', sans-serif", margin: '0 0 4px' }}>
                            Admin Control Center
                        </p>
                        <h2 style={{ fontSize: 'clamp(1.2rem, 5vw, 1.5rem)', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Inter', sans-serif", margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {user?.username || 'Admin'}
                        </h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                            <span style={{
                                fontSize: '0.5rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
                                padding: '2px 8px', borderRadius: '999px',
                                background: 'rgba(245,158,11,0.12)', color: 'var(--gold-mid)',
                                border: '1px solid rgba(245,158,11,0.3)',
                            }}>
                                Admin
                            </span>
                            <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: "'Inter', sans-serif", marginLeft: '4px' }}>
                                {modernDate}
                            </span>
                        </div>
                    </div>
                    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, var(--gold-deep), var(--gold-mid))', color: '#0a0a0a', fontSize: '20px' }}>
                        ⚙️
                    </div>
                </div>
            </div>

            {/* ── 2. KPI overview ── */}
            <div>
                {sectionHeader(activityIcon, 'Key Metrics')}
                {apiError && (
                    <p style={{ fontSize: '0.72rem', color: 'var(--red-status)', margin: '0 0 10px', fontFamily: "'Inter', sans-serif" }}>
                        ⚠ Some data could not be loaded — showing what is available.
                    </p>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {kpiTile('Total Users', (stats?.totalUsers ?? usersData?.totalUsers) ?? 0, loading.users || loading.reports)}
                    {kpiTile('Total Providers', (stats?.totalProviders ?? usersData?.totalProviders) ?? 0, loading.users || loading.reports)}
                    {kpiTile('Pending Deposits', pending.deposits.length, loading.pending, 'var(--gold-mid)')}
                    {kpiTile('Pending Withdrawals', pending.withdrawals.length, loading.pending, 'var(--red-status)')}
                    {kpiTile('Platform Wallet', walletData ? <PointsDisplay amount={walletData.balance} decimals={2} /> : 0, loading.wallet)}
                    {kpiTile('Total Deposits', stats ? <PointsDisplay amount={stats.totalDeposits} decimals={2} /> : 0, loading.reports)}
                </div>
            </div>

            {/* ── 3. Pending actions ── */}
            <div className="card" style={{ padding: 'clamp(14px, 4vw, 18px)' }}>
                {sectionHeader(
                    pendingArrow,
                    'Pending Actions',
                    (pending.deposits.length > 0 || pending.withdrawals.length > 0) && (
                        <button
                            type="button"
                            onClick={() => navigate(`${basePath}/reports`)}
                            style={{
                                background: 'transparent', border: 'none', cursor: 'pointer',
                                color: 'var(--blue-vivid)', fontSize: '0.65rem', fontWeight: 800,
                                letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif",
                                flexShrink: 0,
                            }}
                        >
                            View All →
                        </button>
                    )
                )}

                {loading.pending ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '12px 0', fontFamily: "'Inter', sans-serif" }}>
                        Loading pending requests…
                    </p>
                ) : pendingItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '18px 0' }}>
                        <p style={{ color: 'var(--green-status)', fontSize: '1.6rem', margin: '0 0 4px' }}>✓</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0, fontFamily: "'Inter', sans-serif" }}>
                            No pending requests.
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {pendingItems.map(item => {
                            const busy = busyKey === item.key;
                            return (
                                <div key={item.key} style={{
                                    display: 'flex', alignItems: 'center', gap: '12px',
                                    padding: '12px', borderRadius: '12px',
                                    background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
                                }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                            <span style={{
                                                fontSize: '0.52rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
                                                padding: '2px 7px', borderRadius: '999px',
                                                background: item.kind === 'deposit' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                                                color: item.kind === 'deposit' ? 'var(--green-status)' : 'var(--red-status)',
                                                border: `1px solid ${item.kind === 'deposit' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                            }}>
                                                {item.kind === 'deposit' ? 'Deposit' : 'Withdraw'}
                                            </span>
                                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: "'Inter', sans-serif" }}>
                                                {shortTime(item.created_at)}
                                            </span>
                                        </div>
                                        <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter', sans-serif", margin: '6px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {item.name}
                                        </p>
                                        <p style={{ fontSize: '0.8rem', fontWeight: 600, color: item.kind === 'deposit' ? 'var(--green-status)' : 'var(--red-status)', fontFamily: "'Inter', sans-serif", margin: '2px 0 0' }}>
                                            <PointsDisplay amount={item.amount} decimals={2} size={13} />
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                                        <button
                                            type="button"
                                            disabled={busy || busyKey !== null}
                                            onClick={() => handleRequestAction(item.kind, item.id, 'approve')}
                                            style={{
                                                padding: '6px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                                                background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff',
                                                fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase',
                                                fontFamily: "'Inter', sans-serif", opacity: busy || busyKey !== null ? 0.5 : 1,
                                            }}
                                        >
                                            {busy ? '…' : 'Approve'}
                                        </button>
                                        <button
                                            type="button"
                                            disabled={busy || busyKey !== null}
                                            onClick={() => handleRequestAction(item.kind, item.id, 'reject')}
                                            style={{
                                                padding: '6px 14px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.4)', cursor: 'pointer',
                                                background: 'rgba(239,68,68,0.12)', color: 'var(--red-status)',
                                                fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase',
                                                fontFamily: "'Inter', sans-serif", opacity: busy || busyKey !== null ? 0.5 : 1,
                                            }}
                                        >
                                            {busy ? '…' : 'Reject'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── 4. Financial overview ── */}
            <div className="card" style={{ padding: 'clamp(14px, 4vw, 18px)' }}>
                {sectionHeader(walletIcon, 'Financial Overview')}
                {loading.wallet && loading.reports ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '12px 0', fontFamily: "'Inter', sans-serif" }}>
                        Loading financials…
                    </p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {[
                            { label: 'Platform Wallet', value: <PointsDisplay amount={walletData?.balance ?? 0} decimals={2} /> },
                            { label: 'Total Deposits', value: <PointsDisplay amount={stats?.totalDeposits ?? 0} decimals={2} /> },
                            { label: 'Total Withdrawals', value: <PointsDisplay amount={stats?.totalWithdrawals ?? 0} decimals={2} /> },
                            { label: 'Membership Income', value: <PointsDisplay amount={walletData?.totalMembershipIncome ?? 0} decimals={2} /> },
                            { label: 'Net Holdings', value: <PointsDisplay amount={stats?.netHoldings ?? 0} decimals={2} /> },
                        ].map(row => (
                            <div key={row.label} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px',
                                padding: '10px 12px', borderRadius: '10px',
                                background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
                            }}>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>{row.label}</span>
                                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Inter', sans-serif" }}>{row.value}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── 5. Users & Providers overview ── */}
            <div className="card" style={{ padding: 'clamp(14px, 4vw, 18px)' }}>
                {sectionHeader(usersIcon, 'Users & Providers')}
                {loading.users ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '12px 0', fontFamily: "'Inter', sans-serif" }}>
                        Loading accounts…
                    </p>
                ) : (
                    <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {[
                                { label: 'Users', total: usersData?.totalUsers ?? 0, active: activeUsers, inactive: inactiveUsers, color: 'var(--blue-vivid)' },
                                { label: 'Providers', total: usersData?.totalProviders ?? 0, active: activeProviders, inactive: inactiveProviders, color: 'var(--gold-mid)' },
                            ].map(row => (
                                <div key={row.label} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                                    padding: '11px 12px', borderRadius: '10px',
                                    background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
                                }}>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>{row.label}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontFamily: "'Inter', sans-serif" }}>
                                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: row.color }}>{row.total}</span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.62rem', color: 'var(--green-status)', fontWeight: 600 }}>
                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green-status)', boxShadow: '0 0 6px var(--green-status)' }} />{row.active}
                                        </span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.62rem', color: 'var(--red-status)', fontWeight: 600 }}>
                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red-status)', opacity: 0.8 }} />{row.inactive}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ marginTop: '14px' }}>
                            <p style={{ fontSize: '0.55rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: "'Inter', sans-serif", margin: '0 0 8px' }}>
                                Recent Registrations
                            </p>
                            {recentRegistrations.length === 0 ? (
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontFamily: "'Inter', sans-serif", margin: 0 }}>No registrations yet.</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {recentRegistrations.map(r => (
                                        <div key={`${r.role}-${r.name}-${r.created_at}`} style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                                            padding: '8px 10px', borderRadius: '8px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                                <span style={{
                                                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                                                    background: r.role === 'provider' ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)',
                                                    color: r.role === 'provider' ? 'var(--gold-mid)' : 'var(--blue-vivid)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 800,
                                                }}>
                                                    {r.name ? r.name.trim().slice(0, 1).toUpperCase() : '?'}
                                                </span>
                                                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter', sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {r.name}
                                                </span>
                                            </div>
                                            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: "'Inter', sans-serif", flexShrink: 0 }}>
                                                {r.role === 'provider' ? 'Provider' : 'User'} · {shortTime(r.created_at)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* ── 6. Recent activity ── */}
            <div className="card" style={{ padding: 'clamp(14px, 4vw, 18px)' }}>
                {sectionHeader(activityIcon, 'Recent Activity')}
                {loading.reports ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '12px 0', fontFamily: "'Inter', sans-serif" }}>
                        Loading activity…
                    </p>
                ) : !reportsData || reportsData.ledger.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '12px 0', fontFamily: "'Inter', sans-serif" }}>
                        No activity yet.
                    </p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {reportsData.ledger.slice(0, 8).map(e => {
                            const typeStr = String(e.type);
                            const info = LEDGER_TYPE[typeStr] ?? { label: e.type, color: 'var(--text-secondary)', bg: 'var(--bg-input)' };
                            const negative = typeStr === 'withdraw' || typeStr === 'event_payment';
                            return (
                                <div key={e.id} style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '9px 10px', borderRadius: '10px',
                                    background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
                                }}>
                                    <span style={{
                                        fontSize: '0.5rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase',
                                        padding: '2px 7px', borderRadius: '999px', background: info.bg, color: info.color, flexShrink: 0,
                                    }}>
                                        {info.label}
                                    </span>
                                    <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter', sans-serif" }}>
                                            {e.user_name || `User #${e.user_id}`}
                                        </span>
                                        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: "'Inter', sans-serif", marginLeft: '6px' }}>
                                            {e.status} · {shortTime(e.created_at)}
                                        </span>
                                    </div>
                                    <span style={{ fontSize: '0.76rem', fontWeight: 800, color: negative ? 'var(--red-status)' : 'var(--green-status)', fontFamily: "'Inter', sans-serif", flexShrink: 0 }}>
                                        {negative ? '-' : '+'}<PointsDisplay amount={Number(e.amount)} decimals={2} size={12} />
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── 7. Quick actions ── */}
            <div>
                {sectionHeader(boltIcon, 'Quick Actions')}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {quickActions.map(q => (
                        <button
                            key={q.label}
                            type="button"
                            onClick={() => navigate(`${basePath}${q.to}`)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '13px 12px', borderRadius: '12px', cursor: 'pointer',
                                background: 'linear-gradient(135deg, var(--bg-card-hover) 0%, var(--bg-card) 100%)',
                                border: '1px solid var(--border-subtle)',
                                color: 'var(--text-primary)', textAlign: 'left',
                                fontFamily: "'Inter', sans-serif",
                            }}
                        >
                            <span style={{
                                width: 30, height: 30, borderRadius: '9px', flexShrink: 0,
                                background: q.bg, color: q.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                {q.icon}
                            </span>
                            <span style={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                                {q.label}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default AdminHome;