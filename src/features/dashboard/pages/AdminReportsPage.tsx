import { useEffect, useState, useMemo, useCallback } from 'react';
import { adminApi } from '../../../utils/api';
import type { ReportsData } from '../../../utils/api';
import { motion } from 'framer-motion';

// Build screenshot URLs using the same API base used for other backend requests.
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';




const fmt = (n: number) =>
    '৳ ' + Number(n).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const typeLabel: Record<string, { label: string; color: string; bg: string }> = {
    deposit: { label: 'Deposit', color: 'var(--green-status)', bg: 'rgba(16,185,129,0.1)' },
    withdraw: { label: 'Withdraw', color: 'var(--gold-mid)', bg: 'rgba(197,168,128,0.1)' },
    earning: { label: 'Earning', color: 'var(--blue-vivid)', bg: 'rgba(59,130,246,0.1)' },
    event_payment: { label: 'Event Payment', color: 'var(--red-status)', bg: 'rgba(239,68,68,0.1)' },
    event_income: { label: 'Event Income', color: 'var(--blue-vivid)', bg: 'rgba(59,130,246,0.1)' },
    membership_purchase: { label: 'Membership', color: 'var(--gold-mid)', bg: 'rgba(197,168,128,0.1)' },
    audio_call: { label: 'Audio Call', color: 'var(--blue-vivid)', bg: 'rgba(59,130,246,0.1)' },
};

const fadeUp = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const containerAnim = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.1 } },
};

const Icon = ({ children, color = 'currentColor' }: { children: React.ReactNode; color?: string; }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color }}>
        {children}
    </span>
);

const Svg = ({ children }: { children: React.ReactNode }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {children}
    </svg>
);

const icons = {
    report: (
        <Icon>
            <Svg>
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6 17V7a2 2 0 0 1 2-2h8l4 4v8" />
                <path d="M8 21v-4" />
                <path d="M12 21v-8" />
                <path d="M16 21v-6" />
            </Svg>
        </Icon>
    ),
    deposit: (
        <Icon>
            <Svg>
                <path d="M12 2v20" />
                <path d="M17 7l-5-5-5 5" />
                <path d="M5 22h14" />
            </Svg>
        </Icon>
    ),
    withdraw: (
        <Icon>
            <Svg>
                <path d="M12 2v20" />
                <path d="M17 17l-5 5-5-5" />
                <path d="M5 2h14" />
            </Svg>
        </Icon>
    ),
    earning: (
        <Icon>
            <Svg>
                <path d="M12 1v22" />
                <path d="M17 5l-5-4-5 4" />
                <path d="M7 9h10" />
                <path d="M7 15h10" />
                <path d="M7 21h10" />
            </Svg>
        </Icon>
    ),
    wallet: (
        <Icon>
            <Svg>
                <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" />
                <path d="M16 12h6" />
                <circle cx="16.5" cy="12" r="1.5" />
            </Svg>
        </Icon>
    ),
    user: (
        <Icon>
            <Svg>
                <path d="M20 21a8 8 0 0 0-16 0" />
                <circle cx="12" cy="8" r="4" />
            </Svg>
        </Icon>
    ),
    provider: (
        <Icon>
            <Svg>
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <path d="M20 8v6" />
                <path d="M23 11h-6" />
            </Svg>
        </Icon>
    ),
    topDepositors: (
        <Icon>
            <Svg>
                <path d="M12 2l9 4-9 4-9-4 9-4Z" />
                <path d="M3 10l9 4 9-4" />
                <path d="M3 14l9 4 9-4" />
            </Svg>
        </Icon>
    ),
    topEarners: (
        <Icon>
            <Svg>
                <path d="M12 17.3l-6.18 3.25L7 13l-4-3.94L9.5 8 12 2l2.5 6 6.5 1.06L17 13l1.18 7.55L12 17.3Z" />
            </Svg>
        </Icon>
    ),
    ledger: (
        <Icon>
            <Svg>
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6 17V7a2 2 0 0 1 2-2h8l4 4v8" />
            </Svg>
        </Icon>
    ),
};

type PendingWalletRequest = {
    id: number;
    user_id: number;
    amount: number;
    method: string;
    trx_id?: string;
    screenshot_url?: string;
    account_number?: string;
    status: string;
    created_at: string;
    user_name?: string;
    user_email?: string;
};

export default function AdminReportsPage() {
    const [data, setData] = useState<ReportsData | null>(null);

    // Screenshot preview modal state (frontend-only)
    const [screenshotModalOpen, setScreenshotModalOpen] = useState(false);
    const [screenshotImgUrl, setScreenshotImgUrl] = useState<string>('');
    const [screenshotLoadState, setScreenshotLoadState] = useState<'idle' | 'loading' | 'loaded' | 'failed'>('idle');

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [ledgerFilter, setLedgerFilter] = useState<'all' | 'deposit' | 'withdraw' | 'earning' | 'event_payment' | 'event_income' | 'membership_purchase' | 'audio_call'>('all');
    const [search, setSearch] = useState('');
    const [visibleCount, setVisibleCount] = useState(6);
    const [pendingRequests, setPendingRequests] = useState<{ deposits: PendingWalletRequest[]; withdrawals: PendingWalletRequest[] }>({ deposits: [], withdrawals: [] });
    const [pendingLoading, setPendingLoading] = useState(false);
    const [pendingMessage, setPendingMessage] = useState('');

    const loadPendingRequests = async () => {
        setPendingLoading(true);
        setPendingMessage('');
        try {
            const res = await adminApi.getPendingWalletRequests();
            if (res.error) {
                throw new Error(res.error);
            }
            setPendingRequests(res.data ?? { deposits: [], withdrawals: [] });
        } catch (e: any) {
            setPendingMessage(e?.message || 'Failed to load pending requests');
        } finally {
            setPendingLoading(false);
        }
    };

    useEffect(() => {
        (async () => {
            try {
                const res = await adminApi.getReports();
                if ('error' in res && res.error) {
                    throw new Error(res.error);
                }
                setData(res.data ?? null);
            } catch (e: any) {
                setError(e?.message || 'Failed to load reports');
            } finally {
                setLoading(false);
            }
        })();
        loadPendingRequests();
    }, []);

    const filteredLedger = useMemo(() => {
        const ledger = data?.ledger ?? [];
        return ledger.filter(e => {
            const matchType = ledgerFilter === 'all' || e.type === ledgerFilter;
            const q = search.trim().toLowerCase();
            const matchSearch =
                q === '' ||
                e.user_name.toLowerCase().includes(q) ||
                e.user_role.toLowerCase().includes(q) ||
                e.description?.toLowerCase().includes(q);
            return matchType && matchSearch;
        });
    }, [data, ledgerFilter, search]);

    const visibleLedger = filteredLedger.slice(0, visibleCount);

    const handlePendingAction = async (type: 'deposit' | 'withdraw', id: number, action: 'approve' | 'reject') => {
        setPendingMessage('');
        try {
            const res = action === 'approve'
                ? (type === 'deposit' ? await adminApi.approveDepositRequest(id) : await adminApi.approveWithdrawRequest(id))
                : (type === 'deposit' ? await adminApi.rejectDepositRequest(id) : await adminApi.rejectWithdrawRequest(id));

            if (res.error) {
                throw new Error(res.error);
            }
            setPendingMessage(`${type === 'deposit' ? 'Deposit' : 'Withdrawal'} ${action === 'approve' ? 'approved' : 'rejected'}.`);
            await loadPendingRequests();
        } catch (e: any) {
            setPendingMessage(e?.message || 'Action failed');
        }
    };

    const handleFilterChange = (f: typeof ledgerFilter) => {
        setLedgerFilter(f);
        setVisibleCount(6);
    };

    const buildScreenshotUrl = useCallback((screenshotUrl?: string) => {
        if (!screenshotUrl) return '';

        // backend stores paths like: /uploads/deposits/abc123.png
        if (screenshotUrl.startsWith('http://') || screenshotUrl.startsWith('https://')) return screenshotUrl;

        // api base includes /api (e.g. http://localhost:5000/api), but static files are served from /uploads
        // so we must use the origin without the /api suffix.
        const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

        if (screenshotUrl.startsWith('/')) return `${API_ORIGIN}${screenshotUrl}`;
        // fallback: treat as relative to API origin
        return `${API_ORIGIN}/${screenshotUrl}`;
    }, []);


    const openScreenshotPreview = useCallback((screenshotUrl?: string) => {
        const fullUrl = buildScreenshotUrl(screenshotUrl);
        console.log('screenshot_url:', screenshotUrl);
        console.log('previewUrl:', fullUrl);
        setScreenshotImgUrl(fullUrl);
        setScreenshotLoadState(fullUrl ? 'loading' : 'failed');
        setScreenshotModalOpen(true);
    }, [buildScreenshotUrl]);


    const closeScreenshotPreview = useCallback(() => {
        setScreenshotModalOpen(false);
        setScreenshotImgUrl('');
        setScreenshotLoadState('idle');
    }, []);

    useEffect(() => {
        if (!screenshotModalOpen) return;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeScreenshotPreview();
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [screenshotModalOpen, closeScreenshotPreview]);


    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div className="spinner" style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--border-subtle)', borderTop: '3px solid var(--gold-mid)', animation: 'spin 0.8s linear infinite' }} />
                <p style={{ color: 'var(--text-muted)' }}>Loading Reports…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--red-status)' }}>
                <p>⚠ {error}</p>
            </div>
        );
    }

    const s = data?.stats ?? {
        totalDeposits: 0,
        totalWithdrawals: 0,
        totalEarnings: 0,
        netHoldings: 0,
        totalUsers: 0,
        totalProviders: 0,
    };

    return (
        <motion.div initial="hidden" animate="visible" variants={containerAnim} className="container" style={{ paddingBottom: '100px', paddingTop: '108px' }}>
            
            {/* Header */}
            <motion.div variants={fadeUp} style={{ marginBottom: 'var(--space-8)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, var(--gold-deep), var(--gold-mid))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-gold)' }}>
                    {icons.report}
                </div>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>Platform Reports</h1>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Live financial overview &amp; audit ledger</p>
                </div>
            </motion.div>

            {/* Summary Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
                {[
                    { label: 'Total Deposits', value: fmt(s.totalDeposits), color: 'var(--green-status)', icon: icons.deposit },
                    { label: 'Total Withdrawals', value: fmt(s.totalWithdrawals), color: 'var(--red-status)', icon: icons.withdraw },
                    { label: 'Total Earnings', value: fmt(s.totalEarnings), color: 'var(--blue-vivid)', icon: icons.earning },
                    { label: 'Net Holdings', value: fmt(s.netHoldings), color: 'var(--gold-mid)', icon: icons.wallet },
                    { label: 'Total Users', value: s.totalUsers.toString(), color: 'var(--text-primary)', icon: icons.user },
                    { label: 'Total Providers', value: s.totalProviders.toString(), color: 'var(--text-primary)', icon: icons.provider },
                ].map(card => (
                    <motion.div variants={fadeUp} key={card.label} className="card" style={{ padding: 'var(--space-5) var(--space-4)' }}>
                        <div style={{ fontSize: '1.75rem', marginBottom: 'var(--space-2)', color: card.color }}>{card.icon}</div>
                        <div className="eyebrow" style={{ marginBottom: 'var(--space-1)' }}>{card.label}</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 600, color: card.color }}>{card.value}</div>
                    </motion.div>
                ))}
            </div>

            {/* Pending Requests */}
            <motion.div variants={fadeUp} className="card" style={{ marginBottom: 'var(--space-8)', padding: 'var(--space-6)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                    <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>Pending Wallet Requests</h2>
                    {pendingLoading ? <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Loading…</span> : null}
                </div>
                {pendingMessage ? <div style={{ marginBottom: 'var(--space-3)', padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{pendingMessage}</div> : null}
                <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                    {pendingRequests.deposits.length === 0 && pendingRequests.withdrawals.length === 0 ? (
                        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>No pending deposit or withdrawal requests.</p>
                    ) : null}
                    
                    {pendingRequests.deposits.map((req) => (
                        <div key={`deposit-${req.id}`} style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', background: 'var(--bg-input)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                                <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>Deposit • {req.user_name || 'User'}</strong>
                                <span style={{ color: 'var(--green-status)', fontWeight: 600 }}>৳ {Number(req.amount).toFixed(2)}</span>
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: 'var(--space-1)' }}>{req.method} • {req.trx_id}</div>
                                    {req.screenshot_url ? (
                                        <button
                                            type="button"
                                            onClick={() => openScreenshotPreview(req.screenshot_url)}
                                            style={{
                                                color: 'var(--blue-vivid)',
                                                background: 'transparent',
                                                border: 'none',
                                                padding: 0,
                                                cursor: 'pointer',
                                                fontSize: '0.75rem',
                                                fontWeight: 800,
                                                marginBottom: 'var(--space-2)'
                                            }}
                                        >
                                            View Screenshot
                                        </button>
                                    ) : (
                                        <div style={{ color: 'var(--red-status)', fontSize: '0.75rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                                            Screenshot required
                                        </div>
                                    )}

                            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                <button className="btn btn-sm" style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--green-status)', border: '1px solid rgba(16,185,129,0.3)' }} onClick={() => handlePendingAction('deposit', req.id, 'approve')}>Approve</button>
                                <button className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red-status)', border: '1px solid rgba(239,68,68,0.3)' }} onClick={() => handlePendingAction('deposit', req.id, 'reject')}>Reject</button>
                            </div>
                        </div>
                    ))}
                    
                    {pendingRequests.withdrawals.map((req) => (
                        <div key={`withdraw-${req.id}`} style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', background: 'var(--bg-input)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                                <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>Withdraw • {req.user_name || 'User'}</strong>
                                <span style={{ color: 'var(--gold-mid)', fontWeight: 600 }}>৳ {Number(req.amount).toFixed(2)}</span>
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: 'var(--space-1)' }}>{req.method} • {req.account_number}</div>
                            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                <button className="btn btn-sm" style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--green-status)', border: '1px solid rgba(16,185,129,0.3)' }} onClick={() => handlePendingAction('withdraw', req.id, 'approve')}>Approve</button>
                                <button className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red-status)', border: '1px solid rgba(239,68,68,0.3)' }} onClick={() => handlePendingAction('withdraw', req.id, 'reject')}>Reject</button>
                            </div>
                        </div>
                    ))}
                </div>
            </motion.div>

            {/* Leaderboard Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
                {/* Top Depositors */}
                <motion.div variants={fadeUp} className="card" style={{ padding: 'var(--space-6)' }}>
                    <h2 style={{ margin: '0 0 var(--space-4)', fontSize: '1.125rem', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span style={{ color: 'var(--gold-mid)' }}>{icons.topDepositors}</span> <span>Top Depositors</span>
                    </h2>
                    {data!.topDepositors.length === 0
                        ? <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No data yet</p>
                        : <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            {data!.topDepositors.map((u, i) => (
                                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2)', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: i === 0 ? 'linear-gradient(135deg, var(--gold-deep), var(--gold-light))' : 'var(--bg-card-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: i === 0 ? '#1a1a1a' : 'var(--text-muted)', flexShrink: 0 }}>
                                        {i + 1}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{u.role}</div>
                                    </div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--green-status)', flexShrink: 0 }}>{fmt(u.total_deposited ?? 0)}</div>
                                </div>
                            ))}
                        </div>
                    }
                </motion.div>

                {/* Top Earners */}
                <motion.div variants={fadeUp} className="card" style={{ padding: 'var(--space-6)' }}>
                    <h2 style={{ margin: '0 0 var(--space-4)', fontSize: '1.125rem', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span style={{ color: 'var(--blue-vivid)' }}>{icons.topEarners}</span> <span>Top Earners</span>
                    </h2>
                    {data!.topEarners.length === 0
                        ? <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No data yet</p>
                        : <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            {data!.topEarners.map((u, i) => (
                                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2)', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: i === 0 ? 'linear-gradient(135deg, var(--blue-dim), var(--blue-vivid))' : 'var(--bg-card-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                                        {i + 1}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{u.role}</div>
                                    </div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--blue-vivid)', flexShrink: 0 }}>{fmt(u.total_earned ?? 0)}</div>
                                </div>
                            ))}
                        </div>
                    }
                </motion.div>
            </div>

            {/* Global Ledger */}
            <motion.div variants={fadeUp} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Ledger Header */}
                <div style={{ padding: 'var(--space-5) var(--space-6)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                    <div style={{ flex: 1, minWidth: 160 }}>
                        <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <span style={{ color: 'var(--gold-mid)' }}>{icons.ledger}</span> <span>Global Ledger</span>
                        </h2>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{filteredLedger.length} transactions</p>
                    </div>

                    {/* Search */}
                    <input
                        value={search}
                        onChange={e => { setSearch(e.target.value); setVisibleCount(6); }}
                        placeholder="Search user, role, note…"
                        style={{
                            maxWidth: 220,
                            width: '100%',
                            background: 'var(--bg-input)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-md)',
                            padding: '9px 12px',
                            color: 'var(--text-primary)',
                            fontSize: '0.8rem',
                            fontFamily: "'Inter', sans-serif",
                            outline: 'none',
                            boxSizing: 'border-box',
                            transition: 'border-color 0.2s',
                        }}
                    />

                    {/* Type Filter Tabs */}
                    <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
                        {(['all', 'deposit', 'withdraw', 'earning', 'event_payment', 'event_income', 'membership_purchase', 'audio_call'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => handleFilterChange(f)}
                                className={`badge ${ledgerFilter === f ? 'badge-gold' : ''}`}
                                style={{
                                    border: ledgerFilter === f ? '1px solid var(--border-gold)' : '1px solid var(--border-subtle)',
                                    background: ledgerFilter === f ? 'var(--gold-glow)' : 'transparent',
                                    color: ledgerFilter === f ? 'var(--gold-mid)' : 'var(--text-muted)',
                                    cursor: 'pointer'
                                }}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Cards (Global Ledger) */}
                <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {visibleLedger.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 'var(--space-10)', color: 'var(--text-muted)' }}>
                            No transactions found
                        </div>
                    ) : (
                        visibleLedger.map((e, idx) => {
                            const typeInfo = typeLabel[e.type] ?? { label: e.type, color: 'var(--text-secondary)', bg: 'transparent' };
                            const globalIdx = idx + 1;

                            const amountIsNegative = ((e.type as string) === 'withdraw' || (e.type as string) === 'event_payment');
                            const amountSigned = `${amountIsNegative ? '-' : '+'}${fmt(Number(e.amount))}`;
                            const amountColor = amountIsNegative ? 'var(--red-status)' : 'var(--green-status)';

                            const statusBg =
                                e.status === 'completed' || e.status === 'approved'
                                    ? 'rgba(16,185,129,0.1)'
                                    : e.status === 'pending'
                                        ? 'rgba(245,158,11,0.1)'
                                        : 'rgba(239,68,68,0.1)';

                            const statusColor =
                                e.status === 'completed' || e.status === 'approved'
                                    ? 'var(--green-status)'
                                    : e.status === 'pending'
                                        ? 'var(--gold-mid)'
                                        : 'var(--red-status)';

                            const statusBorder =
                                e.status === 'completed' || e.status === 'approved'
                                    ? 'rgba(16,185,129,0.3)'
                                    : e.status === 'pending'
                                        ? 'var(--border-gold)'
                                        : 'rgba(239,68,68,0.35)';

                            return (
                                <motion.div
                                    key={e.id}
                                    variants={fadeUp}
                                    whileHover={{ y: -2, transition: { duration: 0.18 } }}
                                    style={{
                                        border: '1px solid var(--border-subtle)',
                                        borderRadius: 'var(--radius-lg)',
                                        background: 'rgba(255,255,255,0.04)',
                                        boxShadow: 'var(--shadow-gold)',
                                        backdropFilter: 'blur(10px)',
                                        WebkitBackdropFilter: 'blur(10px)',
                                        overflow: 'hidden',
                                    }}
                                >
                                    {/* Card Header */}
                                    <div
                                        style={{
                                            padding: 'var(--space-4) var(--space-5)',
                                            borderBottom: '1px solid var(--border-subtle)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: 'var(--space-3)',
                                            flexWrap: 'wrap',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                <span style={{ fontWeight: 800, color: 'var(--text-secondary)' }}>#{globalIdx}</span>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                            <span
                                                className="badge"
                                                style={{
                                                    background: statusBg,
                                                    color: statusColor,
                                                    borderColor: statusBorder,
                                                    fontWeight: 800,
                                                }}
                                            >
                                                {e.status}
                                            </span>

                                            <div style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
                                                {new Date(e.created_at).toLocaleString('en-BD', { dateStyle: 'short', timeStyle: 'short' })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card Body */}
                                    <div style={{ padding: 'var(--space-5)' }}>
                                        <div
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: '1.2fr 1fr',
                                                gap: 'var(--space-5)',
                                            }}
                                        >
                                            {/* Left */}
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{e.user_name}</div>
                                                        <span
                                                            className={`badge ${e.user_role === 'admin' ? 'badge-gold' : e.user_role === 'provider' ? 'badge-blue' : ''}`}
                                                            style={{
                                                                background: e.user_role === 'admin' ? 'var(--gold-glow)' : e.user_role === 'provider' ? 'var(--blue-glow)' : 'rgba(16,185,129,0.1)',
                                                                color: e.user_role === 'admin' ? 'var(--gold-mid)' : e.user_role === 'provider' ? 'var(--blue-vivid)' : 'var(--green-status)',
                                                                borderColor: e.user_role === 'admin' ? 'var(--border-gold)' : e.user_role === 'provider' ? 'rgba(59,130,246,0.3)' : 'rgba(16,185,129,0.3)',
                                                                fontWeight: 800,
                                                            }}
                                                        >
                                                            {e.user_role}
                                                        </span>
                                                    </div>

                                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Role</span>: {e.user_role}
                                                    </div>

                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                                            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Transaction Type</span>
                                                        </div>
                                                        <span
                                                            className="badge"
                                                            style={{
                                                                background: typeInfo.bg,
                                                                color: typeInfo.color,
                                                                borderColor: typeInfo.color.replace('var(', '').replace(')', '') === 'var(--text-secondary)' ? 'var(--border-subtle)' : 'currentColor',
                                                                fontWeight: 800,
                                                            }}
                                                        >
                                                            {typeInfo.label}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Right */}
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                                    <div style={{ fontSize: '1.45rem', fontWeight: 900, color: amountColor, lineHeight: 1.1 }}>
                                                        {amountSigned}
                                                    </div>

                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                                        <span
                                                            className="badge"
                                                            style={{
                                                                background: statusBg,
                                                                color: statusColor,
                                                                borderColor: statusBorder,
                                                                fontWeight: 800,
                                                            }}
                                                        >
                                                            {e.status}
                                                        </span>
                                                    </div>

                                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                                                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Date</span>: {new Date(e.created_at).toLocaleString('en-BD', { dateStyle: 'short', timeStyle: 'short' })}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Note */}
                                        <div style={{ marginTop: 'var(--space-4)', color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                                            <div style={{ marginBottom: 'var(--space-1)' }}>
                                                <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>Note</span>
                                            </div>
                                            {e.description || '—'}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })
                    )}
                </div>

                {/* Load More */}
                {filteredLedger.length > visibleCount && (
                    <div style={{ padding: 'var(--space-4) var(--space-6)', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setVisibleCount(c => c + 6)} style={{ padding: '8px 24px' }}>
                            Show more
                        </button>
                    </div>
                )}
            </motion.div>

            <style>{`
              @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        {/* Screenshot Preview Modal (frontend only) */}
        {screenshotModalOpen ? (
            <div
                role="dialog"
                aria-modal="true"
                onMouseDown={(e) => {
                    // Close only when clicking backdrop, not the dialog content.
                    if (e.target === e.currentTarget) closeScreenshotPreview();
                }}
                style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.65)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    padding: 16,
                }}
            >
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <button
                        type="button"
                        aria-label="Close"
                        onClick={closeScreenshotPreview}
                        style={{
                            alignSelf: 'flex-end',
                            background: 'rgba(255,255,255,0.12)',
                            border: '1px solid rgba(255,255,255,0.25)',
                            color: '#fff',
                            width: 36,
                            height: 36,
                            borderRadius: 999,
                            cursor: 'pointer',
                            fontSize: 22,
                            lineHeight: '34px',
                        }}
                    >
                        ×
                    </button>

                    {/* Centered image container */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100%',
                            maxWidth: '90vw',
                            maxHeight: '90vh',
                            borderRadius: 'var(--radius-lg)',
                            overflow: 'hidden',
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            padding: 8,
                        }}
                    >
                        {screenshotLoadState === 'loading' ? (
                            <div style={{ color: 'var(--text-muted)', padding: 24, fontWeight: 700 }}>Loading…</div>
                        ) : null}

                        {(!screenshotImgUrl && screenshotLoadState !== 'loading') ? (
                            <div style={{ color: 'var(--text-muted)', padding: 24, fontWeight: 700 }}>No screenshot available.</div>
                        ) : null}

                        {screenshotImgUrl ? (
                            <img
                                src={screenshotImgUrl}
                                alt="Screenshot"
                                style={{
                                    maxWidth: '90vw',
                                    maxHeight: '90vh',
                                    objectFit: 'contain',
                                    display: screenshotLoadState === 'failed' ? 'none' : 'block',
                                }}
                                onLoad={() => setScreenshotLoadState('loaded')}
                                onError={() => setScreenshotLoadState('failed')}
                            />
                        ) : null}

                        {screenshotLoadState === 'failed' ? (
                            <div style={{ color: 'var(--text-muted)', padding: 24, fontWeight: 700 }}>Failed to load screenshot.</div>
                        ) : null}
                    </div>
                </div>
            </div>
        ) : null}

        <style>{`
              @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
    </motion.div>
    );
}

