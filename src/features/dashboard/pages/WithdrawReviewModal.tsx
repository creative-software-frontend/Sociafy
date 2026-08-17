import { useState } from 'react';
import { adminApi, type WithdrawRequestItem } from '../../../utils/api';
import { useToast } from '../../../components/Toast';
import { PointsDisplay } from '../../../components/PointsDisplay';

const STATUS_STYLE: Record<string, { color: string; bg: string; border: string }> = {
    Pending: { color: 'var(--gold-mid)', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
    Approved: { color: 'var(--blue-vivid)', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)' },
    Completed: { color: 'var(--green-status)', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' },
    Rejected: { color: 'var(--red-status)', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' },
};

function fmtDateTime(d?: string | null): string {
    if (!d) return '—';
    const t = new Date(d);
    if (Number.isNaN(t.getTime())) return '—';
    return t.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px',
            padding: '9px 12px', borderRadius: '10px',
            background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
        }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, fontFamily: "'Inter', sans-serif", flexShrink: 0 }}>
                {label}
            </span>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter', sans-serif", textAlign: 'right', wordBreak: 'break-word' }}>
                {children}
            </span>
        </div>
    );
}

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '11px 14px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border-default)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    fontFamily: "'Inter', sans-serif",
    outline: 'none',
    boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.6rem',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    fontWeight: 700,
    color: 'var(--text-muted)',
    fontFamily: "'Inter', sans-serif",
    marginBottom: '6px',
};

/**
 * Admin review modal for a single withdrawal request. All values shown are
 * server-provided (never computed client-side). Supports the full safe
 * lifecycle: Pending → Approve | Reject(reason) → Approved → Mark as Paid.
 */
export function WithdrawReviewModal({
    withdrawal,
    onClose,
    onAction,
}: {
    withdrawal: WithdrawRequestItem;
    onClose: () => void;
    onAction: () => void;
}) {
    const toast = useToast();
    const [busy, setBusy] = useState<null | 'approve' | 'reject' | 'complete'>(null);
    const [showReject, setShowReject] = useState(false);
    const [showComplete, setShowComplete] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [payTxId, setPayTxId] = useState('');
    const [payAmount, setPayAmount] = useState(String(withdrawal.amount ?? 0));
    const [payMethod, setPayMethod] = useState('bKash');
    const [payNote, setPayNote] = useState('');

    const status = withdrawal.status;

    const handleApprove = async () => {
        setBusy('approve');
        const res = await adminApi.approveWithdrawRequest(withdrawal.id);
        setBusy(null);
        if (res.error) { toast.error(res.error); return; }
        toast.success('Withdrawal approved — awaiting payment');
        onAction();
        onClose();
    };

    const handleReject = async () => {
        if (!rejectReason.trim()) return;
        setBusy('reject');
        const res = await adminApi.rejectWithdrawRequest(withdrawal.id, rejectReason.trim());
        setBusy(null);
        if (res.error) { toast.error(res.error); return; }
        toast.success('Withdrawal rejected — funds refunded to requester');
        onAction();
        onClose();
    };

    const handleComplete = async () => {
        const amt = Number(payAmount);
        if (!payTxId.trim() || !Number.isFinite(amt) || amt <= 0 || !payMethod.trim()) return;
        setBusy('complete');
        const res = await adminApi.completeWithdrawRequest(withdrawal.id, {
            payment_transaction_id: payTxId.trim(),
            payment_amount: amt,
            payment_method: payMethod,
            admin_note: payNote.trim() || undefined,
        });
        setBusy(null);
        if (res.error) { toast.error(res.error); return; }
        toast.success('Withdrawal completed — payment recorded');
        onAction();
        onClose();
    };

    const st = STATUS_STYLE[status] ?? STATUS_STYLE.Pending;

    return (
        <div
            role="dialog"
            aria-modal="true"
            onClick={() => { if (!busy) onClose(); }}
            style={{
                position: 'fixed', inset: 0, zIndex: 600,
                background: 'var(--bg-overlay)', backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: '100%', maxWidth: 520, maxHeight: '90svh', overflowY: 'auto',
                    background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                    borderRadius: '20px', boxShadow: 'var(--shadow-lg)',
                    boxSizing: 'border-box', padding: '20px',
                }}
            >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div>
                        <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Inter', sans-serif" }}>
                            Withdrawal Review
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: "'Inter', sans-serif" }}>
                            {withdrawal.request_id || `#${withdrawal.id}`}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => { if (!busy) onClose(); }}
                        style={{
                            width: 30, height: 30, borderRadius: '50%', cursor: 'pointer',
                            background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
                            color: 'var(--text-secondary)', fontSize: 14, flexShrink: 0,
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Request info (all server-provided) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                    <Row label="Status">
                        <span style={{
                            fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
                            padding: '2px 8px', borderRadius: '999px', background: st.bg, color: st.color,
                            border: `1px solid ${st.border}`,
                        }}>
                            {status}
                        </span>
                    </Row>
                    <Row label="Requester">{withdrawal.user_name || `User #${withdrawal.user_id}`}</Row>
                    <Row label="Email">{withdrawal.user_email || '—'}</Row>
                    <Row label="User ID">#{withdrawal.user_id}</Row>
                    <Row label="Role">{withdrawal.user_role ? (withdrawal.user_role === 'provider' ? 'Provider' : 'User') : '—'}</Row>
                    <Row label="Wallet balance">
                        {withdrawal.user_balance != null
                            ? <PointsDisplay amount={withdrawal.user_balance} decimals={2} />
                            : '—'}
                    </Row>
                    <Row label="Amount">
                        <PointsDisplay amount={withdrawal.amount} decimals={2} />
                    </Row>
                    <Row label="Payment method">{withdrawal.method}</Row>
                    <Row label="Recipient">{withdrawal.account_number}</Row>
                    <Row label="Submitted">{fmtDateTime(withdrawal.created_at)}</Row>
                </div>

                {/* Processing info */}
                {status === 'Approved' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                        <p style={{ margin: '0 0 4px', fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: "'Inter', sans-serif" }}>
                            Processing
                        </p>
                        <Row label="Approved by">{withdrawal.approved_by_name || (withdrawal.approved_by != null ? `Admin #${withdrawal.approved_by}` : '—')}</Row>
                        <Row label="Approved at">{fmtDateTime(withdrawal.approved_at)}</Row>
                    </div>
                )}

                {status === 'Rejected' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                        <p style={{ margin: '0 0 4px', fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: "'Inter', sans-serif" }}>
                            Rejection
                        </p>
                        <Row label="Rejected by">{withdrawal.approved_by_name || (withdrawal.approved_by != null ? `Admin #${withdrawal.approved_by}` : '—')}</Row>
                        <Row label="Rejected at">{fmtDateTime(withdrawal.approved_at)}</Row>
                        <Row label="Reason">{withdrawal.rejection_reason || '—'}</Row>
                        {withdrawal.admin_note ? <Row label="Admin note">{withdrawal.admin_note}</Row> : null}
                    </div>
                )}

                {status === 'Completed' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                        <p style={{ margin: '0 0 4px', fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: "'Inter', sans-serif" }}>
                            Payment
                        </p>
                        <Row label="Payment TXID">{withdrawal.payment_transaction_id || '—'}</Row>
                        <Row label="Paid amount">
                            {withdrawal.payment_amount != null
                                ? <PointsDisplay amount={withdrawal.payment_amount} decimals={2} />
                                : '—'}
                        </Row>
                        <Row label="Payment method">{withdrawal.payment_method || '—'}</Row>
                        <Row label="Paid at">{fmtDateTime(withdrawal.payment_at)}</Row>
                        <Row label="Processed by">{withdrawal.processed_by_name || (withdrawal.processed_by != null ? `Admin #${withdrawal.processed_by}` : '—')}</Row>
                        <Row label="Ledger txn ID">{withdrawal.ledger_transaction_id != null ? `#${withdrawal.ledger_transaction_id}` : '—'}</Row>
                    </div>
                )}

                {/* Reject form */}
                {showReject && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px', padding: '14px', borderRadius: '12px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.25)' }}>
                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: 'var(--red-status)', fontFamily: "'Inter', sans-serif" }}>
                            Reject Withdrawal
                        </p>
                        <div>
                            <label style={labelStyle}>Rejection reason *</label>
                            <textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Explain why this withdrawal is being rejected — this is recorded for the requester."
                                style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button type="button" onClick={() => setShowReject(false)} disabled={!!busy} style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}>
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleReject}
                                disabled={!!busy || !rejectReason.trim()}
                                style={{
                                    padding: '9px 16px', borderRadius: '8px', border: 'none',
                                    background: 'linear-gradient(135deg,#ef4444,#dc2626)', color: '#fff',
                                    fontSize: '0.68rem', fontWeight: 800, cursor: 'pointer',
                                    opacity: busy || !rejectReason.trim() ? 0.5 : 1,
                                }}
                            >
                                {busy === 'reject' ? 'Rejecting…' : 'Reject Withdrawal'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Mark-as-paid form */}
                {showComplete && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px', padding: '14px', borderRadius: '12px', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.25)' }}>
                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: 'var(--green-status)', fontFamily: "'Inter', sans-serif" }}>
                            Record Payment — Mark as Paid
                        </p>
                        <div>
                            <label style={labelStyle}>Payment method *</label>
                            <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                                <option value="bKash">bKash</option>
                                <option value="Nagad">Nagad</option>
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Payment transaction ID *</label>
                            <input value={payTxId} onChange={(e) => setPayTxId(e.target.value)} placeholder="Actual payout TXID from your bKash/Nagad transfer" style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Amount paid *</label>
                            <input type="number" min="0.01" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Admin note (optional)</label>
                            <input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Payment batch reference, remarks…" style={inputStyle} />
                        </div>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button type="button" onClick={() => setShowComplete(false)} disabled={!!busy} style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}>
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleComplete}
                                disabled={!!busy || !payTxId.trim() || !(Number(payAmount) > 0) || !payMethod.trim()}
                                style={{
                                    padding: '9px 16px', borderRadius: '8px', border: 'none',
                                    background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff',
                                    fontSize: '0.68rem', fontWeight: 800, cursor: 'pointer',
                                    opacity: busy || !payTxId.trim() || !(Number(payAmount) > 0) ? 0.5 : 1,
                                }}
                            >
                                {busy === 'complete' ? 'Saving…' : 'Mark as Paid'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Lifecycle actions */}
                {status === 'Pending' && !showReject && !showComplete && (
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            type="button"
                            onClick={() => setShowReject(true)}
                            disabled={!!busy}
                            style={{
                                flex: 1, padding: '12px', borderRadius: '10px', cursor: 'pointer',
                                border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.1)',
                                color: 'var(--red-status)', fontSize: '0.7rem', fontWeight: 800,
                                letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif",
                            }}
                        >
                            Reject
                        </button>
                        <button
                            type="button"
                            onClick={handleApprove}
                            disabled={!!busy}
                            style={{
                                flex: 1, padding: '12px', borderRadius: '10px', cursor: 'pointer', border: 'none',
                                background: 'linear-gradient(135deg,#1d4ed8,#3b82f6)', color: '#fff',
                                fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
                                fontFamily: "'Inter', sans-serif", opacity: busy ? 0.5 : 1,
                            }}
                        >
                            {busy === 'approve' ? 'Approving…' : 'Approve'}
                        </button>
                    </div>
                )}

                {status === 'Approved' && !showReject && !showComplete && (
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            type="button"
                            onClick={() => setShowComplete(true)}
                            disabled={!!busy}
                            style={{
                                flex: 1, padding: '12px', borderRadius: '10px', cursor: 'pointer', border: 'none',
                                background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff',
                                fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
                                fontFamily: "'Inter', sans-serif",
                            }}
                        >
                            Mark as Paid
                        </button>
                    </div>
                )}

                {(status === 'Completed' || status === 'Rejected') && (
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.72rem', fontFamily: "'Inter', sans-serif", margin: 0 }}>
                        {status === 'Completed' ? 'This withdrawal is closed. No further action.' : 'This withdrawal was rejected and funds refunded.'}
                    </p>
                )}
            </div>
        </div>
    );
}

export default WithdrawReviewModal;