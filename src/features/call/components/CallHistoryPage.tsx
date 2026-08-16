import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { callApi } from '../services/callApi';
import type { CallLog } from '../services/callApi';
import { PointsDisplay } from '../../../components/PointsDisplay';

interface Props { onClose: () => void }

const GRAD = ['135deg,#6366f1,#8b5cf6', '135deg,#0ea5e9,#06b6d4', '135deg,#ec4899,#f472b6', '135deg,#10b981,#34d399', '135deg,#f59e0b,#fbbf24', '135deg,#ef4444,#f97316'];
function avatarGrad(n: string) {
    const s = n ?? ''; let h = 0;
    for (let i = 0; i < s.length; i++) h += s.charCodeAt(i);
    return GRAD[h % GRAD.length];
}
function initials(n: string) { return n ? n.slice(0, 2).toUpperCase() : '??'; }

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
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    if (sameDay) return 'Today';
    if (t.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return t.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusStyle(status: string): { label: string; color: string } {
    const map: Record<string, { label: string; color: string }> = {
        connected: { label: 'Connected', color: '#22c55e' },
        missed: { label: 'Missed', color: '#f59e0b' },
        rejected: { label: 'Rejected', color: '#ef4444' },
        cancelled: { label: 'Cancelled', color: 'rgba(255,255,255,0.35)' },
        busy: { label: 'Busy', color: '#ef4444' },
        failed: { label: 'Failed', color: '#ef4444' },
    };
    return map[status] || { label: status, color: 'rgba(255,255,255,0.35)' };
}

type FilterTab = 'all' | 'incoming' | 'outgoing' | 'missed' | 'rejected';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'incoming', label: 'Incoming' },
    { key: 'outgoing', label: 'Outgoing' },
    { key: 'missed', label: 'Missed' },
    { key: 'rejected', label: 'Rejected' },
];

export function CallHistoryPage({ onClose }: Props) {
    const { user } = useAuth();
    const myId = (user as any)?.id as number | undefined;
    const [calls, setCalls] = useState<CallLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<FilterTab>('all');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    const fetchHistory = useCallback(async (p: number, f: FilterTab, s: string) => {
        setLoading(true);
        const params = new URLSearchParams({ page: String(p), limit: '20' });
        if (f !== 'all') params.set('filter', f);
        if (s.trim()) params.set('search', s.trim());
        const res = await callApi.getHistory(params.toString());
        if (!res.error && res.data) {
            setCalls(res.data.calls || []);
            setTotalPages(res.data.totalPages || 1);
            setTotal(res.data.total || 0);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        setPage(1);
        fetchHistory(1, filter, search);
    }, [filter, fetchHistory]);

    useEffect(() => {
        fetchHistory(page, filter, search);
    }, [page, fetchHistory]);

    const handleSearch = () => { setPage(1); fetchHistory(1, filter, search); };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9997,
            display: 'flex', flexDirection: 'column',
            background: '#080d1a',
            fontFamily: "'Inter', -apple-system, sans-serif",
            WebkitFontSmoothing: 'antialiased',
            overflow: 'hidden',
        }}>
            <div style={{ width: '100%', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
                    <button onClick={onClose} aria-label="Close"
                        style={{ width: 40, height: 40, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, WebkitTapHighlightColor: 'transparent' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
                    </button>
                    <h1 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Call History</h1>
                    {total > 0 && <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.75rem', marginLeft: 'auto' }}>{total}</span>}
                </div>

                {/* Search */}
                <div style={{ padding: '10px 12px', flexShrink: 0 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input
                            value={search} onChange={e => setSearch(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
                            placeholder="Search by name..."
                            style={{
                                flex: 1, padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
                                background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '0.85rem',
                                outline: 'none', fontFamily: "'Inter',sans-serif",
                            }}
                        />
                        <button onClick={handleSearch}
                            style={{
                                padding: '9px 16px', borderRadius: 10, border: 'none',
                                background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff',
                                cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem',
                            }}>
                            Search
                        </button>
                    </div>
                </div>

                {/* Filter tabs */}
                <div style={{ display: 'flex', gap: 0, padding: '0 12px 8px', overflowX: 'auto', flexShrink: 0, WebkitOverflowScrolling: 'touch' }}>
                    {FILTER_TABS.map(tab => (
                        <button key={tab.key} onClick={() => setFilter(tab.key)}
                            style={{
                                flex: 1, minWidth: 60, padding: '8px 4px', border: 'none',
                                background: 'transparent', color: filter === tab.key ? '#fff' : 'rgba(255,255,255,0.35)',
                                fontWeight: filter === tab.key ? 700 : 500, fontSize: '0.78rem',
                                cursor: 'pointer', borderBottom: filter === tab.key ? '2px solid #6366f1' : '2px solid transparent',
                                transition: 'all 0.15s', fontFamily: "'Inter',sans-serif",
                                whiteSpace: 'nowrap', WebkitTapHighlightColor: 'transparent',
                            }}>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* List */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
                    {loading && calls.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)', fontSize: '0.9rem' }}>Loading...</div>
                    ) : calls.length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: 12 }}>
                            <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(99,102,241,0.6)" strokeWidth="1.8">
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                </svg>
                            </div>
                            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem', textAlign: 'center' }}>No call history yet</p>
                        </div>
                    ) : (
                        <>
                            {calls.map((call) => {
                                const isIncoming = call.callee_id === myId;
                                const peerName = isIncoming ? call.caller_name : call.callee_name;
                                const s = statusStyle(call.status);
                                return (
                                    <div key={call.id} style={{
                                        display: 'flex', alignItems: 'center', gap: 12,
                                        padding: '14px 8px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                                        WebkitTapHighlightColor: 'transparent',
                                    }}>
                                        <div style={{ width: 44, height: 44, borderRadius: '50%', background: `linear-gradient(${avatarGrad(peerName)})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 15, fontFamily: "'Inter',sans-serif", flexShrink: 0 }}>
                                            {initials(peerName)}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem', margin: '0 0 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {peerName}
                                            </p>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                                                <span style={{ color: isIncoming ? '#22c55e' : '#6366f1', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}>
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        {isIncoming ? (
                                                            <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /><line x1="12" y1="12" x2="12" y2="12" /></>
                                                        ) : (
                                                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                                        )}
                                                    </svg>
                                                    {isIncoming ? 'Incoming' : 'Outgoing'}
                                                </span>
                                                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.55rem' }}>•</span>
                                                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>Audio</span>
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
                                            <p style={{ color: s.color, fontSize: '0.7rem', fontWeight: 700, margin: '0 0 3px', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
                                                {s.label}
                                            </p>
                                            {(call as any).cost != null && (
                                                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.65rem', margin: '0 0 2px', whiteSpace: 'nowrap' }}>
                                                    <PointsDisplay amount={(call as any).cost} decimals={2} />
                                                </p>
                                            )}
                                            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.6rem', margin: 0, whiteSpace: 'nowrap' }}>
                                                {fmtDate(call.created_at)}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '16px 8px' }}>
                                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                                        style={{
                                            padding: '8px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
                                            background: page <= 1 ? 'transparent' : 'rgba(255,255,255,0.06)',
                                            color: page <= 1 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)',
                                            cursor: page <= 1 ? 'default' : 'pointer', fontWeight: 600, fontSize: '0.8rem',
                                            fontFamily: "'Inter',sans-serif", WebkitTapHighlightColor: 'transparent',
                                        }}>
                                        Previous
                                    </button>
                                    <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem' }}>{page} / {totalPages}</span>
                                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                                        style={{
                                            padding: '8px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
                                            background: page >= totalPages ? 'transparent' : 'rgba(255,255,255,0.06)',
                                            color: page >= totalPages ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)',
                                            cursor: page >= totalPages ? 'default' : 'pointer', fontWeight: 600, fontSize: '0.8rem',
                                            fontFamily: "'Inter',sans-serif", WebkitTapHighlightColor: 'transparent',
                                        }}>
                                        Next
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
