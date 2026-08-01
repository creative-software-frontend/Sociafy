import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TopNav } from './TopNav';
import { adminApi } from '../../../utils/api';
import type { AdminWalletTransaction } from '../../../utils/api';
import { useToast } from '../../../components/Toast';

const fadeUp = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

interface WalletData {
    balance: number;
    totalMembershipIncome: number;
    totalCallIncome: number;
    totalWithdrawals: number;
    transactions: AdminWalletTransaction[];
}

const WalletIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" />
    </svg>
);

const icons = {
    balance: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" />
        </svg>
    ),
    membership: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01z" />
        </svg>
    ),
    call: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
    ),
    withdrawn: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 17l5-5-5-5" /><path d="M21 12H9" /><path d="M12 21H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h8" />
        </svg>
    ),
};

function fmtMoney(n: number | undefined): string {
    return `$${Number(n || 0).toFixed(2)}`;
}

function fmtDate(d: string): string {
    const t = new Date(d);
    const now = new Date();
    const sameDay = t.toDateString() === now.toDateString();
    if (sameDay) return t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return t.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

function typeInfo(type: string): { label: string; bg: string; color: string; border: string } {
    switch (type) {
        case 'membership_income':
            return { label: 'Membership', bg: 'var(--gold-glow)', color: 'var(--gold-mid)', border: 'var(--gold-border)' };
        case 'audio_call_income':
            return { label: 'Call Income', bg: 'var(--blue-glow)', color: 'var(--blue-vivid)', border: 'rgba(59,130,246,0.3)' };
        case 'withdraw':
            return { label: 'Withdraw', bg: 'rgba(239,68,68,0.1)', color: 'var(--red-status)', border: 'rgba(239,68,68,0.3)' };
        case 'manual_adjustment':
            return { label: 'Adjustment', bg: 'rgba(16,185,129,0.1)', color: 'var(--green-status)', border: 'rgba(16,185,129,0.3)' };
        default:
            return { label: type, bg: 'var(--bg-input)', color: 'var(--text-secondary)', border: 'var(--border-subtle)' };
    }
}

export function AdminWalletPage() {
    const toast = useToast();
    const [data, setData] = useState<WalletData | null>(null);
    const [loading, setLoading] = useState(true);
    const [showWithdraw, setShowWithdraw] = useState(false);
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('bKash');
    const [trxId, setTrxId] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const load = async () => {
        setLoading(true);
        const res = await adminApi.getAdminWallet();
        if (!res.error && res.data) setData(res.data);
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const handleWithdraw = async () => {
        const value = Number(amount);
        if (!Number.isFinite(value) || value <= 0) {
            toast.error('Enter a valid amount');
            return;
        }
        if (!trxId.trim()) {
            toast.error('Enter a transaction ID');
            return;
        }
        setSubmitting(true);
        const res = await adminApi.withdrawAdminWallet({ amount: value, method, trx_id: trxId.trim() });
        setSubmitting(false);
        if (!res.error && res.data) {
            toast.success('Withdrawal successful.');
            setShowWithdraw(false);
            setAmount('');
            setTrxId('');
            await load();
        } else {
            toast.error(res.error || 'Withdrawal failed');
        }
    };

    const inputStyle: React.CSSProperties = {
        width: '100%',
        background: 'var(--bg-input)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 14px',
        color: 'var(--text-primary)',
        fontSize: '0.9rem',
        fontFamily: "'Inter', sans-serif",
        outline: 'none',
        boxSizing: 'border-box',
        transition: 'border-color 0.2s',
    };

    const statCards = data ? [
        { label: 'Wallet Balance', value: fmtMoney(data.balance), color: 'var(--gold-mid)', icon: icons.balance },
        { label: 'Membership Income', value: fmtMoney(data.totalMembershipIncome), color: 'var(--green-status)', icon: icons.membership },
        { label: 'Call Income', value: fmtMoney(data.totalCallIncome), color: 'var(--blue-vivid)', icon: icons.call },
        { label: 'Total Withdrawals', value: fmtMoney(data.totalWithdrawals), color: 'var(--red-status)', icon: icons.withdrawn },
    ] : [];

    return (
        <>
            <TopNav />
            <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 40px' }}>
                {/* Page header */}
                <motion.div variants={fadeUp} initial="hidden" animate="show" style={{ marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, var(--gold-deep), var(--gold-mid))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-gold)', flexShrink: 0 }}>
                        <WalletIcon />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>Admin Wallet</h1>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Platform revenue &amp; withdrawals</p>
                    </div>
                </motion.div>

                {loading && !data ? (
                    <motion.div variants={fadeUp} initial="hidden" animate="show" className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
                        <div className="spinner" style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--border-subtle)', borderTop: '3px solid var(--gold-mid)', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>Loading wallet...</p>
                    </motion.div>
                ) : (
                    <>
                        {/* Summary stat cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                            {statCards.map((card) => (
                                <motion.div variants={fadeUp} initial="hidden" animate="show" key={card.label} className="card" style={{ padding: 'var(--space-5) var(--space-4)' }}>
                                    <div style={{ fontSize: '1.5rem', marginBottom: 'var(--space-2)', color: card.color }}>{card.icon}</div>
                                    <div className="eyebrow" style={{ marginBottom: 'var(--space-1)' }}>{card.label}</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 600, color: card.color }}>{card.value}</div>
                                </motion.div>
                            ))}
                        </div>

                        {/* Withdraw */}
                        <motion.div variants={fadeUp} initial="hidden" animate="show" className="card" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-5)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showWithdraw ? 'var(--space-4)' : 0 }}>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>Withdraw Funds</h2>
                                    <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Transfer platform revenue out</p>
                                </div>
                                <button
                                    onClick={() => setShowWithdraw(v => !v)}
                                    className={`btn btn-sm ${showWithdraw ? 'btn-ghost' : 'btn-outline'}`}
                                >
                                    {showWithdraw ? 'Cancel' : 'Withdraw'}
                                </button>
                            </div>

                            {showWithdraw && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)' }}>
                                    <div>
                                        <label className="eyebrow" style={{ display: 'block', marginBottom: 'var(--space-1)' }}>Amount</label>
                                        <input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" style={inputStyle} />
                                    </div>
                                    <div>
                                        <label className="eyebrow" style={{ display: 'block', marginBottom: 'var(--space-1)' }}>Method</label>
                                        <select value={method} onChange={e => setMethod(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                                            <option value="bKash">bKash</option>
                                            <option value="Nagad">Nagad</option>
                                            <option value="bank">Bank Transfer</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="eyebrow" style={{ display: 'block', marginBottom: 'var(--space-1)' }}>Transaction ID</label>
                                        <input type="text" value={trxId} onChange={e => setTrxId(e.target.value)} placeholder="e.g. 8M3XK2A9LQ" style={inputStyle} />
                                    </div>
                                    <button onClick={handleWithdraw} disabled={submitting} className="btn btn-primary" style={{ alignSelf: 'flex-end' }}>
                                        {submitting ? 'Processing…' : 'Confirm Withdraw'}
                                    </button>
                                </div>
                            )}
                        </motion.div>

                        {/* Transaction history */}
                        <motion.div variants={fadeUp} initial="hidden" animate="show" className="card" style={{ padding: 'var(--space-6)' }}>
                            <h2 style={{ margin: '0 0 var(--space-4)', fontSize: '1.125rem', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                                Transaction History
                            </h2>

                            {data!.transactions.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 'var(--space-6) 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                    No transactions yet
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    {data!.transactions.map(tx => {
                                        const info = typeInfo(tx.type);
                                        const isCredit = tx.amount > 0;
                                        return (
                                            <div key={tx.id} style={{
                                                display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                                                padding: 'var(--space-3) 0', borderBottom: '1px solid var(--border-subtle)',
                                            }}>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                                        <span className="badge" style={{ background: info.bg, color: info.color, borderColor: info.border, fontWeight: 800 }}>
                                                            {info.label}
                                                        </span>
                                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>{fmtDate(tx.created_at)}</span>
                                                    </div>
                                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', margin: '4px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {tx.description || '—'}
                                                    </p>
                                                </div>
                                                <span style={{
                                                    fontSize: '0.95rem', fontWeight: 700, whiteSpace: 'nowrap',
                                                    color: isCredit ? 'var(--green-status)' : 'var(--red-status)',
                                                }}>
                                                    {isCredit ? '+' : ''}{fmtMoney(tx.amount)}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </motion.div>
                    </>
                )}
            </div>
        </>
    );
}
