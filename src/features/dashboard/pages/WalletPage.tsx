import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TopNav } from "./TopNav";
import { userApi } from "../../../utils/api";
import { useToast } from "../../../components/Toast";
import { PointsDisplay, PointsIcon } from "../../../components/PointsDisplay";

type Transaction = {
    id: number;
    type: string;
    amount: number;
    status: string;
    description: string;
    created_at: string;
};

const allowedScreenshotExt = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const allowedScreenshotMime = new Set(["image/jpeg", "image/png", "image/webp"]);

export function WalletPage() {
    const toast = useToast();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [wallet, setWallet] = useState({
        balance: 0,
        available_balance: 0,
        role: "",
    });

    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [visibleCount, setVisibleCount] = useState(6);

    const [showDepositModal, setShowDepositModal] = useState(false);
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [amountInput, setAmountInput] = useState("");
    const [depositMethod, setDepositMethod] = useState<'bKash' | 'Nagad'>('bKash');
    const [depositTrxId, setDepositTrxId] = useState("");

    // Must upload payment screenshot before submitting deposit request.
    const [depositScreenshotUrl, setDepositScreenshotUrl] = useState<string>('');
    const [uploadProgress, setUploadProgress] = useState<string>('');
    const [uploadingScreenshot, setUploadingScreenshot] = useState(false);


    const [withdrawMethod, setWithdrawMethod] = useState<'bKash' | 'Nagad'>('bKash');
    const [withdrawAccountNumber, setWithdrawAccountNumber] = useState("");
    const [modalStatus, setModalStatus] = useState<{ type: 'error' | 'success'; message: string }>({ type: 'error', message: '' });
    const [modalLoading, setModalLoading] = useState(false);


    async function loadWallet() {
        setLoading(true);
        setError("");

        const res = await userApi.getWallet();

        if (res.error) {
            setError(res.error);
        } else if (res.data) {
            setWallet({
                balance: res.data.balance,
                // Fall back to raw totals for older backend versions
                available_balance: res.data.available_balance ?? res.data.balance,
                role: res.data.role,
            });
            setTransactions(res.data.transactions || []);
        }

        setLoading(false);
    }

    useEffect(() => {
        loadWallet();
    }, []);

    const handleDeposit = async (e: React.FormEvent) => {
        e.preventDefault();
        setModalStatus({ type: 'error', message: '' });
        const amt = parseFloat(amountInput);
        if (isNaN(amt) || amt <= 0) {
            setModalStatus({ type: 'error', message: 'Please enter a valid positive amount.' });
            return;
        }
        if (!depositTrxId.trim()) {
            setModalStatus({ type: 'error', message: 'Transaction ID is required.' });
            return;
        }

        // REQUIRED: Screenshot upload must be successful before submit.
        if (!depositScreenshotUrl.trim()) {
            setModalStatus({ type: 'error', message: 'Please upload your payment screenshot.' });
            return;
        }

        try {
            setModalLoading(true);
            const res = await userApi.deposit({
                amount: amt,
                method: depositMethod,
                trx_id: depositTrxId.trim(),
                screenshot_url: depositScreenshotUrl.trim(),
            });
            if (res.error) {
                setModalStatus({ type: 'error', message: res.error });
            } else {
                setAmountInput("");
                setDepositMethod('bKash');
                setDepositTrxId("");
                setDepositScreenshotUrl('');
                setUploadProgress('');
                setModalStatus({ type: 'success', message: '' });
                toast.success('Waiting for admin approval.');
                setShowDepositModal(false);
                await loadWallet();
            }
        } catch (err: any) {
            setModalStatus({ type: 'error', message: err.message || 'Deposit failed' });
        } finally {
            setModalLoading(false);
        }
    };

    const handleWithdraw = async (e: React.FormEvent) => {
        e.preventDefault();
        setModalStatus({ type: 'error', message: '' });
        const amt = parseFloat(amountInput);
        if (isNaN(amt) || amt <= 0) {
            setModalStatus({ type: 'error', message: 'Please enter a valid positive amount.' });
            return;
        }
        // Use server-calculated available amount (balance minus pending withdrawals).
        // Providers use a single balance wallet, so available funds = available_balance.
        const availableFunds = wallet.available_balance;
        if (amt > availableFunds) {
            setModalStatus({
                type: 'error',
                message: `Insufficient available balance. Available: ${Number(availableFunds).toFixed(2)}`
            });
            return;
        }

        const mobile = withdrawAccountNumber.trim();

        if (!mobile) {
            setModalStatus({ type: 'error', message: 'Mobile number is required.' });
            return;
        }

        // Frontend should have already stripped non-digits, but keep strict UX safety
        if (!/^\d+$/.test(mobile)) {
            setModalStatus({ type: 'error', message: 'Only numbers are allowed.' });
            return;
        }

        if (mobile.length !== 11) {
            setModalStatus({ type: 'error', message: 'Mobile number must be exactly 11 digits.' });
            return;
        }

        if (!/^01[3-9][0-9]{8}$/.test(mobile)) {
            setModalStatus({ type: 'error', message: 'Please enter a valid Bangladesh mobile number.' });
            return;
        }

        try {
            setModalLoading(true);
            const res = await userApi.withdraw({
                amount: amt,
                method: withdrawMethod,
                account_number: mobile,
            });
            if (res.error) {
                setModalStatus({ type: 'error', message: res.error });
            } else {
                setAmountInput("");
                setWithdrawMethod('bKash');
                setWithdrawAccountNumber("");
                setModalStatus({ type: 'success', message: '' });
                toast.success('Waiting for admin approval.');
                setShowWithdrawModal(false);
                await loadWallet();
            }
        } catch (err: any) {
            setModalStatus({ type: 'error', message: err.message || 'Withdrawal failed' });
        } finally {
            setModalLoading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
                minHeight: "100vh",
                background: "var(--bg-main)",
                width: "100%",
                color: "var(--text-primary)",
            }}
        >
            <TopNav />

            <div
                style={{
                    maxWidth: "2400px",
                    margin: "0 auto",
                    width: "100%",
                    padding: "76px 16px 48px 16px",
                    boxSizing: "border-box",
                }}
            >
                <div style={{ marginBottom: "24px" }}>
                    <h2
                        style={{
                            fontFamily: "'Inter', sans-serif",
                            fontSize: "clamp(1.3rem, 5vw, 1.75rem)",
                            fontWeight: 700,
                            color: "var(--text-primary)",
                            marginBottom: "4px",
                        }}
                    >
                        Wallet
                    </h2>
                    <p
                        style={{
                            fontSize: "0.75rem",
                            color: "var(--text-muted)",
                            fontFamily: "'Inter', sans-serif",
                        }}
                    >
                        Manage your balance, deposits, and withdrawals
                    </p>
                </div>

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "1fr",
                        gap: "24px",
                    }}
                >
                    {/* Balance & action row */}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
                            gap: "24px",
                            width: "100%",
                            alignItems: "stretch",
                        }}
                    >
                        {/* Balance cards */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                                    gap: "16px",
                                    width: "100%",
                                }}
                            >
                                <div
                                    style={{
                                        background: "linear-gradient(135deg, var(--bg-card-hover), var(--bg-card))",
                                        border: "1px solid var(--border-subtle)",
                                        borderRadius: "16px",
                                        padding: "24px",
                                        textAlign: "center",
                                        boxShadow: "var(--shadow-md)",
                                    }}
                                >
                                    <p
                                        style={{
                                            fontSize: "0.65rem",
                                            letterSpacing: "0.2em",
                                            textTransform: "uppercase",
                                            color: "var(--text-secondary)",
                                            fontWeight: 700,
                                            marginBottom: "8px",
                                        }}
                                    >
                                        Wallet Balance
                                    </p>
                                    <p
                                        style={{
                                            fontSize: "2rem",
                                            fontWeight: 800,
                                            color: "var(--text-primary)",
                                            fontFamily: "'Inter', sans-serif",
                                        }}
                                    >
                                        <PointsDisplay amount={wallet.balance} decimals={2} />
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: "24px",
                                width: "100%",
                            }}
                        >
                            {[
                                {
                                    label: "DEPOSIT",
                                    sub: "Deposit funds to wallet",
                                    onClick: () => {
                                        setAmountInput("");
                                        setDepositMethod('bKash');
                                        setDepositTrxId("");
                                        setDepositScreenshotUrl('');
                                        setUploadProgress('');
                                        setModalStatus({ type: 'error', message: '' });
                                        setShowDepositModal(true);
                                    },
                                    icon: (
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--blue-vivid)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                                        </svg>
                                    ),
                                },
                                {
                                    label: "WITHDRAW",
                                    sub: "Withdraw your balance",
                                    onClick: () => {
                                        setAmountInput("");
                                        setWithdrawMethod('bKash');
                                        setWithdrawAccountNumber("");
                                        setModalStatus({ type: 'error', message: '' });
                                        setShowWithdrawModal(true);
                                    },
                                    icon: (
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--blue-vivid)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
                                        </svg>
                                    ),
                                },
                            ].map((btn) => (
                                <button
                                    key={btn.label}
                                    onClick={btn.onClick}
                                    style={{
                                        background: "var(--bg-card)",
                                        border: "1px solid var(--border-subtle)",
                                        borderRadius: "16px",
                                        padding: "32px 24px",
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: "12px",
                                        cursor: "pointer",
                                        transition: "all 0.2s ease-in-out",
                                        boxSizing: "border-box",
                                        boxShadow: "var(--shadow-sm)",
                                        width: "100%",
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = "var(--blue-neon)";
                                        e.currentTarget.style.boxShadow = "0 0 20px var(--blue-glow)";
                                        e.currentTarget.style.transform = "translateY(-2px)";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = "var(--border-subtle)";
                                        e.currentTarget.style.boxShadow = "var(--shadow-sm)";
                                        e.currentTarget.style.transform = "translateY(0px)";
                                    }}
                                >
                                    <div style={{ marginBottom: "4px" }}>{btn.icon}</div>
                                    <span
                                        style={{
                                            fontSize: "0.85rem",
                                            letterSpacing: "0.05em",
                                            textTransform: "uppercase",
                                            color: "var(--text-primary)",
                                            fontFamily: "'Inter', sans-serif",
                                            fontWeight: 700,
                                        }}
                                    >
                                        {btn.label}
                                    </span>
                                    <span
                                        style={{
                                            fontSize: "0.75rem",
                                            color: "var(--text-secondary)",
                                            fontFamily: "'Inter', sans-serif",
                                            textAlign: "center",
                                            fontWeight: 400,
                                        }}
                                    >
                                        {btn.sub}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Ledger history */}
                    <div
                        style={{
                            background: "var(--bg-card)",
                            border: "1px solid var(--border-subtle)",
                            borderRadius: "16px",
                            padding: "32px 24px",
                            width: "100%",
                            boxSizing: "border-box",
                            boxShadow: "var(--shadow-md)",
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--blue-vivid)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" />
                                <line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" />
                                <line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                            </svg>
                            <span
                                style={{
                                    fontSize: "1.1rem",
                                    fontWeight: 600,
                                    color: "var(--text-secondary)",
                                    fontFamily: "'Inter', sans-serif",
                                }}
                            >
                                Ledger History
                            </span>
                        </div>

                        {loading ? (
                            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>Loading records...</div>
                        ) : error ? (
                            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--red-status)" }}>{error}</div>
                        ) : transactions.length === 0 ? (
                            <div style={{ textAlign: "center", padding: "40px 0 24px 0" }}>
                                <p
                                    style={{
                                        color: "var(--text-primary)",
                                        fontSize: "0.9rem",
                                        fontFamily: "'Inter', sans-serif",
                                        fontWeight: 400,
                                        letterSpacing: "0.01em",
                                    }}
                                >
                                    No ledger records found.
                                </p>
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "60vh", overflowY: "auto", paddingRight: "4px" }}>
                                {transactions.slice(0, visibleCount).map((tx) => {
                                    const isPositive = tx.type === "deposit" || tx.type === "earning" || tx.type === "event_income";
                                    const isPending = tx.status === "pending";
                                    const isRejected = tx.status === "rejected";

                                    // Status badge colors
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
                                    const statusLabel = isPending ? "Pending" : isRejected ? "Rejected" : "Completed";

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
                                        <div
                                            key={tx.id}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                background: isPending ? "rgba(245,158,11,0.03)" : isRejected ? "rgba(239,68,68,0.03)" : "var(--bg-input)",
                                                border: isPending ? "1px solid rgba(245,158,11,0.25)" : isRejected ? "1px solid rgba(239,68,68,0.2)" : "1px solid var(--border-subtle)",
                                                borderRadius: "12px",
                                                padding: "16px 20px",
                                                transition: "border-color 0.2s",
                                                opacity: isRejected ? 0.75 : 1,
                                            }}
                                        >
                                            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                                                <div
                                                    style={{
                                                        width: "36px",
                                                        height: "36px",
                                                        borderRadius: "50%",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        background: iconBg,
                                                        color: iconColor,
                                                        fontWeight: 800,
                                                    }}
                                                >
                                                    {tx.type === "withdraw" || tx.type === "event_payment" ? "↓" : tx.type === "deposit" ? "↑" : "★"}
                                                </div>
                                                <div>
                                                    <p style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
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
                                                </div>
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: "1rem",
                                                    fontWeight: 800,
                                                    color: isPending
                                                        ? "var(--text-muted)"
                                                        : isRejected
                                                        ? "var(--text-muted)"
                                                        : isPositive
                                                        ? "var(--green-status)"
                                                        : "var(--red-status)",
                                                    textDecoration: isRejected ? "line-through" : "none",
                                                }}
                                            >
                                                {isPositive ? "+" : "-"}<PointsDisplay amount={tx.amount} decimals={2} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {transactions.length > visibleCount && (
                            <div style={{ textAlign: "center", marginTop: "16px" }}>
                                <button
                                    onClick={() => setVisibleCount(c => c + 6)}
                                    style={{
                                        padding: "10px 28px",
                                        borderRadius: "8px",
                                        background: "var(--blue-glow)",
                                        border: "1px solid rgba(59,130,246,0.3)",
                                        color: "var(--blue-vivid)",
                                        fontSize: "0.8rem",
                                        fontWeight: 700,
                                        letterSpacing: "0.08em",
                                        textTransform: "uppercase",
                                        cursor: "pointer",
                                        fontFamily: "'Inter', sans-serif",
                                        transition: "all 0.15s",
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-card-hover)"; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = "var(--blue-glow)"; }}
                                >
                                    Show more
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Deposit Modal */}
            {showDepositModal && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: "var(--bg-overlay)",
                        backdropFilter: "blur(8px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 9999,
                    }}
                >
                    <form
                        onSubmit={handleDeposit}
                        style={{
                            background: "var(--bg-card)",
                            border: "1px solid var(--border-gold)",
                            borderRadius: "16px",
                            padding: "32px",
                            width: "100%",
                            maxWidth: "400px",
                            boxShadow: "var(--shadow-gold)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "20px",
                            position: "relative",
                        }}
                    >
                        <div
                            style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                right: 0,
                                height: "2px",
                                background: "linear-gradient(90deg, transparent, var(--gold-mid), transparent)",
                            }}
                        />
                        <div>
                            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
                                DEPOSIT FUNDS
                            </h3>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                Enter the amount in Taka to deposit into your account wallet. Screenshot upload is required.
                            </p>

                        </div>

                        {modalStatus.message ? (
                            <div
                                style={{
                                    padding: "8px 12px",
                                    background: modalStatus.type === 'success' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)',
                                    border: `1px solid ${modalStatus.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                    borderRadius: "6px",
                                    color: modalStatus.type === 'success' ? '#86efac' : '#fca5a5',
                                    fontSize: "0.78rem",
                                }}
                            >
                                {modalStatus.message}
                            </div>
                        ) : null}

                        <div style={{ position: "relative" }}>
                            <span style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", fontWeight: 700, color: "var(--text-muted)" }}>
                                <PointsIcon size={22} />
                            </span>
                            <input
                                type="number"
                                step="any"
                                placeholder="0.00"
                                value={amountInput}
                                onChange={(e) => setAmountInput(e.target.value)}
                                style={{
                                    width: "100%",
                                    padding: "14px 16px 14px 36px",
                                    background: "var(--bg-input)",
                                    border: "1px solid var(--border-subtle)",
                                    borderRadius: "8px",
                                    color: "var(--text-primary)",
                                    fontSize: "1rem",
                                    outline: "none",
                                    boxSizing: "border-box",
                                }}
                                autoFocus
                            />
                        </div>

                        <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Payment Method
                            <select
                                value={depositMethod}
                                onChange={(e) => setDepositMethod(e.target.value as 'bKash' | 'Nagad')}
                                style={{ padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                            >
                                <option value="bKash">bKash</option>
                                <option value="Nagad">Nagad</option>
                            </select>
                        </label>

                        <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Transaction ID
                            <input
                                value={depositTrxId}
                                onChange={(e) => setDepositTrxId(e.target.value)}
                                placeholder="Enter transaction ID"
                                style={{ padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                            />
                        </label>

                        <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Payment Screenshot
                            <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                disabled={uploadingScreenshot}
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;

                                    if (uploadingScreenshot) return;

                                    const ext = file.name?.toLowerCase().includes('.')
                                        ? file.name.slice(file.name.lastIndexOf('.'))
                                        : '';

                                    const extOk = allowedScreenshotExt.has(ext);
                                    const mimeOk = allowedScreenshotMime.has(file.type);
                                    if (!extOk || !mimeOk) {
                                        setModalStatus({ type: 'error', message: 'Only jpg, jpeg, png, webp images are allowed.' });
                                        return;
                                    }
                                    if (file.size > 5 * 1024 * 1024) {
                                        setModalStatus({ type: 'error', message: 'Maximum file size is 5MB.' });
                                        return;
                                    }

                                    try {
                                        setModalStatus({ type: 'error', message: '' });
                                        setUploadProgress('Uploading…');
                                        setUploadingScreenshot(true);

                                        const uploadRes = await userApi.uploadImage(file, 'deposits');

                                        if (uploadRes.error || !uploadRes.data?.url) {
                                            throw new Error(uploadRes.error || 'Upload failed');
                                        }

                                        setDepositScreenshotUrl(uploadRes.data.url);
                                        setUploadProgress('');
                                    } catch (err: any) {
                                        setDepositScreenshotUrl('');
                                        setUploadProgress('');
                                        setModalStatus({ type: 'error', message: err?.message || 'Upload failed' });
                                    } finally {
                                        setUploadingScreenshot(false);
                                    }
                                }}
                                style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                            />

                            {uploadingScreenshot ? (
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700 }}>
                                    {uploadProgress || 'Uploading…'}
                                </div>
                            ) : depositScreenshotUrl ? (
                                <div style={{ color: 'var(--green-status)', fontSize: '0.75rem', fontWeight: 800 }}>
                                    Screenshot uploaded ✓
                                </div>
                            ) : (
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                    Please upload your payment screenshot.
                                </div>
                            )}
                        </label>


                        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                            <button
                                type="button"
                                onClick={() => setShowDepositModal(false)}
                                style={{
                                    padding: "10px 16px",
                                    background: "transparent",
                                    border: "1px solid var(--border-subtle)",
                                    borderRadius: "6px",
                                    color: "var(--text-secondary)",
                                    cursor: "pointer",
                                    fontSize: "0.75rem",
                                    fontWeight: 700,
                                }}
                            >
                                CANCEL
                            </button>
                            <button
                                type="submit"
                                disabled={modalLoading || uploadingScreenshot}

                                style={{
                                    padding: "10px 20px",
                                    background: "linear-gradient(135deg, var(--blue-neon), var(--blue-vivid))",
                                    border: "none",
                                    borderRadius: "6px",
                                    color: "#fff",
                                    cursor: "pointer",
                                    fontSize: "0.75rem",
                                    fontWeight: 700,
                                }}
                            >
                                {modalLoading ? "DEPOSITING..." : "DEPOSIT"}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Withdraw Modal */}
            {showWithdrawModal && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: "var(--bg-overlay)",
                        backdropFilter: "blur(8px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 9999,
                    }}
                >
                    <form
                        onSubmit={handleWithdraw}
                        style={{
                            background: "var(--bg-card)",
                            border: "1px solid var(--border-gold)",
                            borderRadius: "16px",
                            padding: "32px",
                            width: "100%",
                            maxWidth: "400px",
                            boxShadow: "var(--shadow-gold)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "20px",
                            position: "relative",
                        }}
                    >
                        <div
                            style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                right: 0,
                                height: "2px",
                                background: "linear-gradient(90deg, transparent, var(--gold-mid), transparent)",
                            }}
                        />
                        <div>
                            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
                                WITHDRAW FUNDS
                            </h3>
                            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                Enter the amount to withdraw.<br />
                                <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                                    Available balance:{" "}
                                    <PointsDisplay amount={wallet.available_balance} decimals={2} />
                                </span>
                                {wallet.balance !== wallet.available_balance && <><br /><span style={{ fontSize: "0.7rem", color: "var(--gold-mid)" }}>Total balance: <PointsDisplay amount={wallet.balance} decimals={2} /> (<PointsDisplay amount={wallet.balance - wallet.available_balance} decimals={2} /> reserved)</span></>}
                            </p>
                        </div>

                        {modalStatus.message ? (
                            <div
                                style={{
                                    padding: "8px 12px",
                                    background: modalStatus.type === 'success' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)',
                                    border: `1px solid ${modalStatus.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                    borderRadius: "6px",
                                    color: modalStatus.type === 'success' ? '#86efac' : '#fca5a5',
                                    fontSize: "0.78rem",
                                }}
                            >
                                {modalStatus.message}
                            </div>
                        ) : null}

                        <div style={{ position: "relative" }}>
                            <span style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", fontWeight: 700, color: "var(--text-muted)" }}>
                                <PointsIcon size={22} />
                            </span>
                            <input
                                type="number"
                                step="any"
                                placeholder="0.00"
                                value={amountInput}
                                onChange={(e) => setAmountInput(e.target.value)}
                                style={{
                                    width: "100%",
                                    padding: "14px 16px 14px 36px",
                                    background: "var(--bg-input)",
                                    border: "1px solid var(--border-subtle)",
                                    borderRadius: "8px",
                                    color: "var(--text-primary)",
                                    fontSize: "1rem",
                                    outline: "none",
                                    boxSizing: "border-box",
                                }}
                                autoFocus
                            />
                        </div>

                        <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Method
                            <select
                                value={withdrawMethod}
                                onChange={(e) => setWithdrawMethod(e.target.value as 'bKash' | 'Nagad')}
                                style={{ padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                            >
                                <option value="bKash">bKash</option>
                                <option value="Nagad">Nagad</option>
                            </select>
                        </label>

                        <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Account Number
                            <input
                                value={withdrawAccountNumber}
                                onChange={(e) => {
                                    // Numeric-only UX: strip everything non-digit and cap at 11 digits
                                    const digitsOnly = (e.target.value || "").replace(/\D/g, "").slice(0, 11);
                                    setWithdrawAccountNumber(digitsOnly);
                                }}
                                placeholder="Enter account/mobile number"
                                inputMode="numeric"
                                autoComplete="off"
                                style={{ padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                            />
                        </label>

                        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                            <button
                                type="button"
                                onClick={() => setShowWithdrawModal(false)}
                                style={{
                                    padding: "10px 16px",
                                    background: "transparent",
                                    border: "1px solid var(--border-subtle)",
                                    borderRadius: "6px",
                                    color: "var(--text-secondary)",
                                    cursor: "pointer",
                                    fontSize: "0.75rem",
                                    fontWeight: 700,
                                }}
                            >
                                CANCEL
                            </button>
                            <button
                                type="submit"
                                disabled={modalLoading}
                                style={{
                                    padding: "10px 20px",
                                    background: "linear-gradient(135deg, var(--blue-neon), var(--blue-vivid))",
                                    border: "none",
                                    borderRadius: "6px",
                                    color: "#fff",
                                    cursor: "pointer",
                                    fontSize: "0.75rem",
                                    fontWeight: 700,
                                }}
                            >
                                {modalLoading ? "WITHDRAWING..." : "WITHDRAW"}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </motion.div>
    );
}