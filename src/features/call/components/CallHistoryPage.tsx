import { useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { callApi } from '../services/callApi';
import type { CallLog } from '../services/callApi';

interface Props {
    onClose: () => void;
}

const GRAD = ['135deg,#6366f1,#8b5cf6', '135deg,#0ea5e9,#06b6d4', '135deg,#ec4899,#f472b6', '135deg,#10b981,#34d399', '135deg,#f59e0b,#fbbf24', '135deg,#ef4444,#f97316'];
function avatarGrad(n: string) {
    const s = n ?? '';
    let h = 0;
    for (let i = 0; i < s.length; i++) h += s.charCodeAt(i);
    return GRAD[h % GRAD.length];
}
function initials(n: string) {
    return n ? n.slice(0, 2).toUpperCase() : '??';
}

function fmtDuration(secs: number | null): string {
    if (secs == null) return '--';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtDate(d: string): string {
    const t = new Date(d);
    const now = new Date();
    const sameDay = t.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = t.toDateString() === yesterday.toDateString();
    if (sameDay) return 'Today';
    if (isYesterday) return 'Yesterday';
    return t.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusLabel(status: string): string {
    const map: Record<string, string> = {
        connected: 'Connected',
        missed: 'Missed',
        rejected: 'Rejected',
        busy: 'Busy',
        cancelled: 'Cancelled',
        failed: 'Failed',
    };
    return map[status] || status;
}

function statusColor(status: string): string {
    if (status === 'connected') return '#22c55e';
    if (status === 'missed') return '#f59e0b';
    return '#ef4444';
}

function CallIcon({ incoming }: { incoming: boolean }) {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {incoming ? (
                <>
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    <line x1="12" y1="12" x2="12" y2="12" />
                </>
            ) : (
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            )}
        </svg>
    );
}

export function CallHistoryPage({ onClose }: Props) {
    const { user } = useAuth();
    const myId = (user as any)?.id as number | undefined;
    const [calls, setCalls] = useState<CallLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            setLoading(true);
            const res = await callApi.getHistory();
            if (!res.error && res.data) setCalls(res.data.calls);
            setLoading(false);
        })();
    }, []);

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9997,
            display: 'flex',
            flexDirection: 'column',
            background: '#080d1a',
            fontFamily: "'Inter', -apple-system, sans-serif",
            WebkitFontSmoothing: 'antialiased',
            overflow: 'hidden',
        }}>
            <div style={{
                width: '100%',
                maxWidth: 480,
                margin: '0 auto',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
            }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                flexShrink: 0,
            }}>
                <button
                    onClick={onClose}
                    style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: 'rgba(255,255,255,0.05)',
                        color: 'rgba(255,255,255,0.7)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        WebkitTapHighlightColor: 'transparent',
                    }}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
                </button>
                <h1 style={{
                    color: '#fff',
                    fontSize: '1.2rem',
                    fontWeight: 700,
                    margin: 0,
                    letterSpacing: '-0.02em',
                }}>
                    Call History
                </h1>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)', fontSize: '0.9rem' }}>
                        Loading...
                    </div>
                ) : calls.length === 0 ? (
                    <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        padding: '60px 20px', gap: 12,
                    }}>
                        <div style={{
                            width: 64, height: 64, borderRadius: 20,
                            background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(99,102,241,0.6)" strokeWidth="1.8">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                            </svg>
                        </div>
                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem', textAlign: 'center' }}>
                            No call history yet
                        </p>
                    </div>
                ) : (
                    calls.map((call) => {
                        const isIncoming = call.callee_id === myId;
                        const peerName = isIncoming ? call.caller_name : call.callee_name;
                        return (
                            <div key={call.id} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                padding: '14px 8px',
                                borderBottom: '1px solid rgba(255,255,255,0.04)',
                                cursor: 'default',
                                WebkitTapHighlightColor: 'transparent',
                            }}>
                                <div style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: '50%',
                                    background: `linear-gradient(${avatarGrad(peerName)})`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#fff',
                                    fontWeight: 800,
                                    fontSize: 15,
                                    fontFamily: "'Inter',sans-serif",
                                    flexShrink: 0,
                                }}>
                                    {initials(peerName)}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{
                                        color: '#fff',
                                        fontWeight: 700,
                                        fontSize: '0.95rem',
                                        margin: '0 0 4px',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                    }}>
                                        {peerName}
                                    </p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                                        <span style={{
                                            color: isIncoming ? '#22c55e' : '#6366f1',
                                            fontSize: '0.7rem',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 3,
                                            whiteSpace: 'nowrap',
                                        }}>
                                            <CallIcon incoming={isIncoming} />
                                            {isIncoming ? 'Incoming' : 'Outgoing'}
                                        </span>
                                        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.55rem' }}>•</span>
                                        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                                            Audio
                                        </span>
                                        {call.duration_seconds != null && call.status === 'connected' && (
                                            <>
                                                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.55rem' }}>•</span>
                                                <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                                                    {fmtDuration(call.duration_seconds)}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                                    <p style={{
                                        color: statusColor(call.status),
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                        margin: '0 0 3px',
                                        letterSpacing: '0.02em',
                                        whiteSpace: 'nowrap',
                                    }}>
                                        {statusLabel(call.status)}
                                    </p>
                                    <p style={{
                                        color: 'rgba(255,255,255,0.25)',
                                        fontSize: '0.65rem',
                                        margin: 0,
                                        whiteSpace: 'nowrap',
                                    }}>
                                        {fmtDate(call.created_at)}
                                    </p>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
            </div>
        </div>
    );
}
