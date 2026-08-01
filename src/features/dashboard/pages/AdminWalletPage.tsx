import { useEffect, useState } from 'react';
import { TopNav } from './TopNav';
import { adminApi } from '../../../utils/api';
import type { AdminWalletTransaction } from '../../../utils/api';
import { useToast } from '../../../components/Toast';

interface WalletData {
    balance: number;
    totalMembershipIncome: number;
    totalCallIncome: number;
    totalWithdrawals: number;
    transactions: AdminWalletTransaction[];
}

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

function typeLabel(type: string): string {
    const map: Record<string, string> = {
        membership_income: 'Membership Income',
        audio_call_income: 'Call Income',
        manual_adjustment: 'Manual Adjustment',
        withdraw: 'Withdraw',
    };
    return map[type] || type;
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
        const res = await adminApi.withdrawAdminWallet({
            amount: value,
            method,
            trx_id: trxId.trim(),
        });
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

    return (
        <>
            <style>{`@keyframes fadeInPage{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
            <TopNav />
            <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px', animation: 'fadeInPage .3s ease' }}>
                <h1 style={{ color: '#fff', fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 20px' }}>
                    Admin Wallet
                </h1>

                {/* Summary card */}
                <div style={{
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))',
                    border: '1px solid rgba(99,102,241,0.25)',
                    borderRadius: 16,
                    padding: '20px 18px',
                    marginBottom: 16,
                }}>
                    <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', margin: '0 0 6px' }}>
                        CURRENT BALANCE
                    </p>
                    <h2 style={{ color: '#fff', fontSize: '2rem', fontWeight: 800, margin: '0 0 16px', letterSpacing: '-0.02em' }}>
                        {fmtMoney(data?.balance)}
                    </h2>
                    <div style={{ display: 'flex', gap: 16 }}>
                        <div style={{ flex: 1 }}>
                            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.6rem', margin: '0 0 2px' }}>MEMBERSHIP INCOME</p>
                            <p style={{ color: '#22c55e', fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>{fmtMoney(data?.totalMembershipIncome)}</p>
                        </div>
                        <div style={{ flex: 1 }}>
                            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.6rem', margin: '0 0 2px' }}>CALL INCOME</p>
                            <p style={{ color: '#6366f1', fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>{fmtMoney(data?.totalCallIncome)}</p>
                        </div>
                        <div style={{ flex: 1 }}>
                            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.6rem', margin: '0 0 2px' }}>WITHDRAWN</p>
                            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>{fmtMoney(data?.totalWithdrawals)}</p>
                        </div>
                    </div>
                </div>

                {/* Withdraw */}
                <button
                    onClick={() => setShowWithdraw(v => !v)}
                    style={{
                        width: '100%',
                        padding: '14px',
                        borderRadius: 12,
                        border: '1px solid rgba(239,68,68,0.3)',
                        background: 'rgba(239,68,68,0.08)',
                        color: '#ef4444',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        fontFamily: "'Inter',sans-serif",
                        marginBottom: showWithdraw ? 12 : 20,
                    }}>
                    {showWithdraw ? 'Cancel Withdraw' : 'Withdraw Funds'}
                </button>

                {showWithdraw && (
                    <div style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 16,
                        padding: '18px',
                        marginBottom: 20,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                    }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginBottom: 6 }}>
                                Amount
                            </label>
                            <input
                                type="number" min="0.01" step="0.01" value={amount}
                                onChange={e => setAmount(e.target.value)}
                                placeholder="0.00"
                                style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 14px', color: '#fff', fontSize: '0.95rem', fontFamily: "'Inter',sans-serif", outline: 'none' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginBottom: 6 }}>
                                Method
                            </label>
                            <select
                                value={method} onChange={e => setMethod(e.target.value)}
                                style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 14px', color: '#fff', fontSize: '0.95rem', fontFamily: "'Inter',sans-serif", outline: 'none' }}>
                                <option value="bKash">bKash</option>
                                <option value="Nagad">Nagad</option>
                                <option value="bank">Bank Transfer</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginBottom: 6 }}>
                                Transaction ID
                            </label>
                            <input
                                type="text" value={trxId} onChange={e => setTrxId(e.target.value)}
                                placeholder="e.g. 8M3XK2A9LQ"
                                style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 14px', color: '#fff', fontSize: '0.95rem', fontFamily: "'Inter',sans-serif", outline: 'none' }}
                            />
                        </div>
                        <button
                            onClick={handleWithdraw}
                            disabled={submitting}
                            style={{
                                padding: '13px',
                                borderRadius: 10,
                                border: 'none',
                                background: submitting ? 'rgba(239,68,68,0.5)' : '#ef4444',
                                color: '#fff',
                                fontWeight: 700,
                                fontSize: '0.9rem',
                                cursor: submitting ? 'default' : 'pointer',
                                fontFamily: "'Inter',sans-serif",
                            }}>
                            {submitting ? 'Processing...' : 'Confirm Withdraw'}
                        </button>
                    </div>
                )}

                {/* Transaction history */}
                <h2 style={{ color: '#fff', fontSize: '1rem', fontWeight: 700, margin: '0 0 10px' }}>
                    Transaction History
                </h2>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>Loading...</div>
                    ) : !data || data.transactions.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>No transactions yet</div>
                    ) : (
                        data.transactions.map(tx => {
                            const isCredit = tx.amount > 0;
                            return (
                                <div key={tx.id} style={{
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                                }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600, margin: '0 0 3px' }}>
                                            {typeLabel(tx.type)}
                                        </p>
                                        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {tx.description || '—'}
                                        </p>
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <p style={{ color: isCredit ? '#22c55e' : '#ef4444', fontSize: '0.85rem', fontWeight: 700, margin: '0 0 3px' }}>
                                            {isCredit ? '+' : ''}{fmtMoney(tx.amount)}
                                        </p>
                                        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.65rem', margin: 0 }}>
                                            {fmtDate(tx.created_at)}
                                        </p>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </>
    );
}
