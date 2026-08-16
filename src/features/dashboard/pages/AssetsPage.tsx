import { useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { TopNav } from './TopNav';
import { userApi, type Transaction } from '../../../utils/api';
import { useToast } from '../../../components/Toast';
import { PointsDisplay, PointsIcon } from '../../../components/PointsDisplay';

export function AssetsPage() {
    const { user } = useAuth();
    const role = user?.role;
    const toast = useToast();

    const [balance, setBalance] = useState(0);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [visibleCount, setVisibleCount] = useState(6);

    // Modal states
    const [showDepositModal, setShowDepositModal] = useState(false);
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [amountInput, setAmountInput] = useState('');
    const [modalError, setModalError] = useState('');
    const [modalLoading, setModalLoading] = useState(false);

    // New state variables for withdrawal
    const [withdrawMethod, setWithdrawMethod] = useState('bKash');
    const [withdrawNumber, setWithdrawNumber] = useState('');

    const depositLabel = 'DEPOSIT';
    const depositSub = 'Deposit funds to wallet';
    const withdrawLabel = 'WITHDRAW';
    const withdrawSub = 'Withdraw your balance';

    const fetchWallet = async () => {
        try {
            setLoading(true);
            const res = await userApi.getWallet();
            if (res.error) {
                setError(res.error);
            } else if (res.data) {
                setBalance(res.data.balance);
                setTransactions(res.data.transactions);
            }
        } catch (e: any) {
            setError(e.message || 'Failed to fetch wallet info');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWallet();
    }, []);



    const handleDeposit = async (e: React.FormEvent) => {
        e.preventDefault();
        setModalError('');
        const amt = parseFloat(amountInput);
        if (isNaN(amt) || amt <= 0) {
            setModalError('Please enter a valid positive amount.');
            return;
        }

        try {
            setModalLoading(true);
            const res = await userApi.deposit(amt);
            if (res.error) {
                setModalError(res.error);
            } else {
                setAmountInput('');
                setShowDepositModal(false);
                await fetchWallet();
            }
        } catch (err: any) {
            setModalError(err.message || 'Deposit failed');
        } finally {
            setModalLoading(false);
        }
    };

    const handleWithdraw = async (e: React.FormEvent) => {
        e.preventDefault();
        setModalError('');
        const amt = parseFloat(amountInput);
        if (isNaN(amt) || amt <= 0) {
            setModalError('Please enter a valid positive amount.');
            return;
        }
        const limit = balance;
        if (amt > limit) {
            setModalError('Insufficient balance to withdraw.');
            return;
        }

        if (!/^01[3-9]\d{8}$/.test(withdrawNumber)) {
            setModalError('Please enter a valid Bangladesh mobile number.');
            return;
        }

        try {
            setModalLoading(true);
            const res = await userApi.withdraw({
                amount: amt,
                method: withdrawMethod as 'bKash' | 'Nagad',
                account_number: withdrawNumber
            });
            if (res.error) {
                setModalError(res.error);
            } else {
                setAmountInput('');
                setShowWithdrawModal(false);
                toast.success('Waiting for admin approval.');
                await fetchWallet();
            }
        } catch (err: any) {
            setModalError(err.message || 'Withdrawal failed');
        } finally {
            setModalLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-main)', width: '100%', color: 'var(--text-primary)' }}>
            {/* Top Navigation Bar */}
            <TopNav />

            {/* Main Content Layout Container */}
            <div style={{
                maxWidth: '2400px',
                margin: '0 auto',
                width: '100%',
                padding: '76px 16px 48px 16px',
                boxSizing: 'border-box'
            }}>

                {/* Structural Wrapper Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr',
                    gap: '24px'
                }}>

                    {/* Upper Row: Dynamic Cards Grid System */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
                        gap: '24px',
                        width: '100%',
                        alignItems: 'stretch'
                    }}>

                        {/* Balance Display Column */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Single Assets Card (used for both user and provider) */}
                            <div style={{
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: '16px',
                                    padding: '48px 24px',
                                    textAlign: 'center',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    boxShadow: 'var(--shadow-md)'
                                }}>
                                    <p style={{
                                        fontSize: '0.65rem',
                                        letterSpacing: '0.2em',
                                        textTransform: 'uppercase',
                                        color: 'var(--text-secondary)',
                                        fontFamily: "'Inter', sans-serif",
                                        fontWeight: 700,
                                        marginBottom: '16px',
                                    }}>
                                        TOTAL LIQUID ASSETS
                                    </p>
                                    <p style={{
                                        fontSize: '3.5rem',
                                        fontWeight: 700,
                                        color: 'var(--text-primary)',
                                        fontFamily: "'Inter', sans-serif",
                                        letterSpacing: '-0.02em',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        textShadow: '0 0 30px rgba(255, 255, 255, 0.15)'
                                    }}>
                                        <PointsDisplay amount={balance} decimals={2} />
                                    </p>
                                </div>
                        </div>

                        {/* Column 2: Action Buttons Layout Framework */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: role === 'provider' ? '1fr' : '1fr 1fr',
                            gap: '24px',
                            width: '100%'
                        }}>
                            {[
                                ...([{
                                    label: depositLabel,
                                    sub: depositSub,
                                    onClick: () => {
                                        setAmountInput('');
                                        setModalError('');
                                        setShowDepositModal(true);
                                    },
                                    icon: (
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--blue-vivid)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                                        </svg>
                                    ),
                                }]),
                                {
                                     label: withdrawLabel,
                                     sub: withdrawSub,
                                     onClick: () => {
                                         setAmountInput('');
                                         setWithdrawMethod('bKash');
                                         setWithdrawNumber('');
                                         setModalError('');
                                         setShowWithdrawModal(true);
                                     },
                                    icon: (
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--blue-vivid)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
                                        </svg>
                                    ),
                                },
                            ].map(btn => (
                                <button key={btn.label} onClick={btn.onClick} style={{
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: '16px',
                                    padding: '32px 24px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '12px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease-in-out',
                                    boxSizing: 'border-box',
                                    boxShadow: 'var(--shadow-sm)',
                                    width: '100%'
                                }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.borderColor = 'var(--blue-neon)';
                                        e.currentTarget.style.boxShadow = '0 0 20px var(--blue-glow)';
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.borderColor = 'var(--border-subtle)';
                                        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                                        e.currentTarget.style.transform = 'translateY(0px)';
                                    }}
                                >
                                    <div style={{ marginBottom: '4px' }}>
                                        {btn.icon}
                                    </div>
                                    <span style={{
                                        fontSize: '0.85rem',
                                        letterSpacing: '0.05em',
                                        textTransform: 'uppercase',
                                        color: 'var(--text-primary)',
                                        fontFamily: "'Inter', sans-serif",
                                        fontWeight: 700,
                                    }}>{btn.label}</span>
                                    <span style={{
                                        fontSize: '0.75rem',
                                        color: 'var(--text-secondary)',
                                        fontFamily: "'Inter', sans-serif",
                                        textAlign: 'center',
                                        fontWeight: 400
                                    }}>{btn.sub}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Lower Area: Full-width ledger history module */}
                    <div style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '16px',
                        padding: '32px 24px',
                        width: '100%',
                        boxSizing: 'border-box',
                        boxShadow: 'var(--shadow-md)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--blue-vivid)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" />
                                <line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" />
                                <line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                            </svg>
                            <span style={{
                                fontSize: '1.1rem',
                                fontWeight: 600,
                                color: 'var(--text-secondary)',
                                fontFamily: "'Inter', sans-serif"
                            }}>
                                Ledger History
                            </span>
                        </div>

                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>Loading records...</div>
                        ) : error ? (
                            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--red-status)' }}>{error}</div>
                        ) : transactions.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '40px 0 24px 0',
                            }}>
                                <p style={{
                                    color: 'var(--text-primary)',
                                    fontSize: '0.9rem',
                                    fontFamily: "'Inter', sans-serif",
                                    fontWeight: 400,
                                    letterSpacing: '0.01em'
                                }}>
                                    No ledger records found.
                                </p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '60vh', overflowY: 'auto', paddingRight: '4px' }}>
                                {transactions.slice(0, visibleCount).map((tx) => {
                                    const isPositive = tx.type === 'deposit' || tx.type === 'earning' || tx.type === 'event_income';
                                    const isPending = tx.status === "pending";
                                    const isRejected = tx.status === "rejected";
                                    const isApproved = tx.status === "approved";
                                    const statusLabel = isPending ? "Pending" : isRejected ? "Rejected" : isApproved ? "Approved" : "Completed";

                                    const statusBg = isPending
                                        ? "rgba(245,158,11,0.15)"
                                        : isRejected
                                        ? "rgba(239,68,68,0.15)"
                                        : "rgba(16,185,129,0.15)";
                                    const statusColor = isPending
                                        ? "var(--gold-mid)"
                                        : isRejected
                                        ? "var(--red-status)"
                                        : "var(--green-status)";

                                    // Icon color is muted for pending/rejected
                                    const iconBg =
                                        tx.type === "withdraw" || tx.type === "event_payment"
                                            ? `rgba(239, 68, 68, ${isPending ? "0.08" : "0.15"})`
                                            : tx.type === "deposit"
                                            ? `rgba(59, 130, 246, ${isPending ? "0.08" : "0.15"})`
                                            : `rgba(245, 158, 11, ${isPending ? "0.08" : "0.15"})`;
                                    const iconColor =
                                        isPending || isRejected
                                            ? "var(--text-muted)"
                                            : tx.type === "withdraw" || tx.type === "event_payment"
                                            ? "var(--red-status)"
                                            : tx.type === "deposit"
                                            ? "var(--blue-vivid)"
                                            : "var(--gold-mid)";

                                    return (
                                        <div key={tx.id} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            background: isPending ? "rgba(245,158,11,0.03)" : isRejected ? "rgba(239,68,68,0.03)" : "var(--bg-input)",
                                            border: isPending ? "1px solid rgba(245,158,11,0.25)" : isRejected ? "1px solid rgba(239,68,68,0.2)" : "1px solid var(--border-subtle)",
                                            borderRadius: '12px',
                                            padding: '16px 20px',
                                            transition: 'border-color 0.2s',
                                            opacity: isRejected ? 0.75 : 1,
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                                <div style={{
                                                    width: '36px',
                                                    height: '36px',
                                                    borderRadius: '50%',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    background: iconBg,
                                                    color: iconColor,
                                                    fontWeight: 800,
                                                }}>
                                                    {tx.type === 'withdraw' || tx.type === 'event_payment' ? '↓' : tx.type === 'deposit' ? '↑' : '★'}
                                                </div>
                                                <div>
                                                    <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                                                        {tx.description}
                                                    </p>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                                            {new Date(tx.created_at).toLocaleString()}
                                                        </span>
                                                        <span style={{
                                                            fontSize: "0.65rem",
                                                            fontWeight: 700,
                                                            textTransform: "uppercase",
                                                            letterSpacing: "0.06em",
                                                            padding: "2px 7px",
                                                            borderRadius: "20px",
                                                            background: statusBg,
                                                            color: statusColor,
                                                        }}>
                                                            {statusLabel}
                                                        </span>
                                                    </div>
                                                    {tx.type === 'withdraw' && (
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                                                            Method: {(tx as any).withdraw_method || (tx as any).method || 'bKash/Nagad'} | Number: {(tx as any).withdraw_number || (tx as any).account_number || '01XXXXXXXXX'}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{
                                                fontSize: '1rem',
                                                fontWeight: 800,
                                                color: isPending
                                                    ? "var(--text-muted)"
                                                    : isRejected
                                                    ? "var(--text-muted)"
                                                    : isPositive
                                                    ? "var(--green-status)"
                                                    : "var(--red-status)",
                                                textDecoration: isRejected ? "line-through" : "none",
                                            }}>
                                                {isPositive ? '+' : '-'}<PointsDisplay amount={tx.amount} decimals={2} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {transactions.length > visibleCount && (
                            <div style={{ textAlign: 'center', marginTop: '16px' }}>
                                <button
                                    onClick={() => setVisibleCount(c => c + 6)}
                                    style={{
                                        padding: '10px 28px',
                                        borderRadius: '8px',
                                        background: 'var(--blue-glow)',
                                        border: '1px solid rgba(59,130,246,0.3)',
                                        color: 'var(--blue-vivid)',
                                        fontSize: '0.8rem',
                                        fontWeight: 700,
                                        letterSpacing: '0.08em',
                                        textTransform: 'uppercase',
                                        cursor: 'pointer',
                                        fontFamily: "'Inter', sans-serif",
                                        transition: 'all 0.15s',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--blue-glow)'; }}
                                >
                                    Show more
                                </button>
                            </div>
                        )}
                    </div>

                </div>
            </div>

            {/* Deposit / Allocate Modal */}
            {showDepositModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'var(--bg-overlay)', backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
                }}>
                    <form onSubmit={handleDeposit} style={{
                        background: 'var(--bg-card)', border: '1px solid var(--border-gold)',
                        borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '400px',
                        boxShadow: 'var(--shadow-gold)', display: 'flex', flexDirection: 'column', gap: '20px',
                        position: 'relative'
                    }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, var(--gold-mid), transparent)' }} />
                        <div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                                {depositLabel} FUNDS
                            </h3>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Enter the amount in Taka to deposit into your account wallet.
                            </p>
                        </div>

                        {modalError && (
                            <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#fca5a5', fontSize: '0.78rem' }}>
                                {modalError}
                            </div>
                        )}

                        <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: 'var(--text-muted)' }}><PointsIcon size={22} /></span>
                            <input
                                type="number"
                                step="any"
                                placeholder="0.00"
                                value={amountInput}
                                onChange={(e) => setAmountInput(e.target.value)}
                                style={{
                                    width: '100%', padding: '14px 16px 14px 36px',
                                    background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
                                    borderRadius: '8px', color: 'var(--text-primary)', fontSize: '1rem',
                                    outline: 'none', boxSizing: 'border-box'
                                }}
                                autoFocus
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button type="button" onClick={() => setShowDepositModal(false)} style={{ padding: '10px 16px', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>
                                CANCEL
                            </button>
                            <button type="submit" disabled={modalLoading} style={{ padding: '10px 20px', background: 'linear-gradient(135deg, var(--blue-neon), var(--blue-vivid))', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>
                                {modalLoading ? 'DEPOSITING...' : 'DEPOSIT'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Withdraw / Liquidate Modal */}
            {showWithdrawModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'var(--bg-overlay)', backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
                }}>
                    <form onSubmit={handleWithdraw} style={{
                        background: 'var(--bg-card)', border: '1px solid var(--border-gold)',
                        borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '400px',
                        boxShadow: 'var(--shadow-gold)', display: 'flex', flexDirection: 'column', gap: '20px',
                        position: 'relative'
                    }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, var(--gold-mid), transparent)' }} />
                        <div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                                {withdrawLabel} FUNDS
                            </h3>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Enter the amount to withdraw.<br/>
                                <br/>
                                Available balance: <PointsDisplay amount={balance} decimals={2} />
                            </p>
                        </div>

                        {modalError && (
                            <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#fca5a5', fontSize: '0.78rem' }}>
                                {modalError}
                            </div>
                        )}

                        <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: 'var(--text-muted)' }}><PointsIcon size={22} /></span>
                            <input
                                type="number"
                                step="any"
                                placeholder="0.00"
                                value={amountInput}
                                onChange={(e) => setAmountInput(e.target.value)}
                                style={{
                                    width: '100%', padding: '14px 16px 14px 36px',
                                    background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
                                    borderRadius: '8px', color: 'var(--text-primary)', fontSize: '1rem',
                                    outline: 'none', boxSizing: 'border-box'
                                }}
                                autoFocus
                            />
                        </div>

                        <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Method
                            <select
                                value={withdrawMethod}
                                onChange={(e) => setWithdrawMethod(e.target.value)}
                                style={{ padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                            >
                                <option value="bKash">bKash</option>
                                <option value="Nagad">Nagad</option>
                            </select>
                        </label>

                        <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Account Number
                            <input
                                value={withdrawNumber}
                                onChange={(e) => setWithdrawNumber(e.target.value)}
                                placeholder="Enter account/mobile number"
                                style={{ padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                            />
                        </label>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button type="button" onClick={() => setShowWithdrawModal(false)} style={{ padding: '10px 16px', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>
                                CANCEL
                            </button>
                            <button type="submit" disabled={modalLoading} style={{ padding: '10px 20px', background: 'linear-gradient(135deg, var(--blue-neon), var(--blue-vivid))', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>
                                {modalLoading ? 'WITHDRAWING...' : 'WITHDRAW'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

        </div>
    );
}