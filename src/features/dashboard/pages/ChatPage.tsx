import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../../../context/AuthContext';
import { useMembership } from '../../../context/MembershipContext';
import { serviceApi, providerApi, userApi } from '../../../utils/api';
import type { ChatMessage, ActiveUser } from '../../../utils/api';
import { TopNav } from './TopNav';
import { FeatureGate } from '../../../components/FeatureGate';
import { CallButton } from '../../call/components/CallButton';
import { useCallContext } from '../../call/context/callContextValue';
import { CallHistoryPage } from '../../call/components/CallHistoryPage';


/* ─── helpers ─── */
const GRAD = ['135deg,#6366f1,#8b5cf6', '135deg,#0ea5e9,#06b6d4', '135deg,#ec4899,#f472b6', '135deg,#10b981,#34d399', '135deg,#f59e0b,#fbbf24', '135deg,#ef4444,#f97316'];
const ug = (n?: string | null) => {
    const s = n ?? '';
    let h = 0;
    for (let i = 0; i < s.length; i++) h += s.charCodeAt(i);
    return GRAD[h % GRAD.length];
};
const ini = (n: string) => n ? n.slice(0, 2).toUpperCase() : '??';
const fmtTime = (d: string) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const fmtDate = (d: string) => {
    const t = new Date(d), now = new Date();
    if (t.toDateString() === now.toDateString()) return 'Today';
    const y = new Date(now); y.setDate(now.getDate() - 1);
    if (t.toDateString() === y.toDateString()) return 'Yesterday';
    return t.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
};
const timeAgo = (d: string) => { const s = (Date.now() - new Date(d).getTime()) / 1000; if (s < 60) return 'just now'; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`; return `${Math.floor(s / 86400)}d ago`; };

/* ─── Avatar ─── */
function Av({ name, size = 40, online = false }: { name: string; size?: number; online?: boolean }) {
    return (
        <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
                width: size, height: size, borderRadius: '50%',
                background: `linear-gradient(${ug(name)})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 800, fontSize: size * 0.35,
                fontFamily: "'Inter',sans-serif", letterSpacing: '0.02em',
                boxShadow: `0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2)`,
            }}>{ini(name)}</div>
            {online && <span style={{
                position: 'absolute', bottom: 1, right: 1,
                width: size * 0.28, height: size * 0.28, borderRadius: '50%',
                background: '#22c55e', border: `${size > 36 ? 2 : 1.5}px solid #0a0f1e`,
                boxShadow: '0 0 8px #22c55e88',
            }} />}
        </div>
    );
}

/* ─── Typing dots ─── */
function TypingDots() {
    return (
        <div style={{ display: 'flex', gap: 4, padding: '10px 14px', alignItems: 'center' }}>
            {[0, 1, 2].map(i => (
                <div key={i} style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: 'rgba(99,102,241,0.7)',
                    animation: `chatDot 1.2s ease-in-out ${i * 0.2}s infinite`,
                }} />
            ))}
        </div>
    );
}

/* ─── Inline keyframes injected once ─── */
const STYLE = `
@keyframes chatDot{0%,80%,100%{transform:scale(0.6);opacity:.4}40%{transform:scale(1);opacity:1}}
@keyframes msgIn{from{opacity:0;transform:translateY(10px) scale(0.97)}to{opacity:1;transform:none}}
@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
`;

export function ChatPage() {
    const { user } = useAuth();
    const myId = (user as any)?.id as number | undefined;
    const myName = user?.username ?? (user as any)?.name ?? 'Me';
    const isProvider = (user as any)?.role === 'provider';
    const { hasFeature } = useMembership();
    const { callState } = useCallContext();

    const [contacts, setContacts] = useState<ActiveUser[]>([]);
    const [cLoading, setCLoading] = useState(true);
    const [selected, setSelected] = useState<ActiveUser | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [mLoading, setMLoading] = useState(false);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [search, setSearch] = useState('');
    const [showTyping, setShowTyping] = useState(false);
    // unreadCounts: partnerId → unread message count
    const [unreadCounts, setUnreadCounts] = useState<Map<number, number>>(new Map());
    const bottomRef = useRef<HTMLDivElement>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const textRef = useRef<HTMLTextAreaElement>(null);

    const socketRef = useRef<Socket | null>(null);

    const socketConnectedRef = useRef(false);
    const lastSocketMessageIdsRef = useRef<Set<number>>(new Set());

    const selectedIdRef = useRef<number | null>(null);

    // Partner-request gating: a USER can only chat with a PROVIDER once the
    // partner request is accepted (plus Silver membership, enforced backend).
    const [partnerLocked, setPartnerLocked] = useState(false);
    const [partnerChecking, setPartnerChecking] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    useEffect(() => {
        (async () => {
            setCLoading(true);
            const res = isProvider ? await providerApi.getOnlineUsers() : await serviceApi.getActiveProviders();
            if (!res.error) setContacts(res.data ?? []);
            setCLoading(false);
        })();
    }, [isProvider]);

    useEffect(() => {
        const token = localStorage.getItem('bluedise_token');
        const backendUrl = import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || 'http://localhost:5000';

        if (!token) return;
        const socket = io(backendUrl, {
            auth: { token },
            transports: ['websocket'],
        });

        socketRef.current = socket;

        // Stable named handlers (cleanup uses the exact same references)
        const handleConnect = () => {
            socketConnectedRef.current = true;
        };

        const handleDisconnect = () => {
            socketConnectedRef.current = false;
        };

        const handleTyping = ({ sender_id }: { sender_id?: number }) => {
            if (!sender_id) return;
            if (!selectedIdRef.current) return;
            if (Number(sender_id) === selectedIdRef.current) setShowTyping(true);
        };

        const handleStopTyping = ({ sender_id }: { sender_id?: number }) => {
            if (!sender_id) return;
            if (!selectedIdRef.current) return;
            if (Number(sender_id) === selectedIdRef.current) setShowTyping(false);
        };

        const normalizeSocketMessage = (payload: any) => {
            const normalized: any = {
                id: Number(payload?.id),
                sender_id: Number(payload?.sender_id),
                receiver_id: Number(payload?.receiver_id),
                message: String(payload?.message ?? ''),
                created_at: payload?.created_at ?? new Date().toISOString(),
                sender_name: String(payload?.sender_name ?? ''),
            };
            return normalized;
        };

        const handleNewMessage = (payload: any) => {
            if (!payload || typeof payload !== 'object') return;

            const normalized = normalizeSocketMessage(payload);
            const incomingId = normalized?.id;
            if (!Number.isFinite(incomingId)) return;

            // Dedupe guard
            if (lastSocketMessageIdsRef.current.has(incomingId)) return;
            lastSocketMessageIdsRef.current.add(incomingId);

            // Which user is the "other" party in this message?
            const partnerId = normalized.sender_id === myId
                ? normalized.receiver_id
                : normalized.sender_id;

            const isActiveThread =
                selectedIdRef.current !== null &&
                Number(selectedIdRef.current) === Number(partnerId);

            // ── 1. Update contacts sidebar (always) ──────────────────────────
            // Attach the latest message preview; add the contact if not present.
            setContacts((prev) => {
                const idx = prev.findIndex((c) => c.id === partnerId);
                const preview: ActiveUser & { latestMessage?: string; latestTime?: string } = idx !== -1
                    ? { ...prev[idx], latestMessage: normalized.message, latestTime: normalized.created_at }
                    : {
                        id: partnerId,
                        name: normalized.sender_name || `User ${partnerId}`,
                        last_seen: normalized.created_at,
                        is_online: 1,
                        latestMessage: normalized.message,
                        latestTime: normalized.created_at,
                    };
                if (idx !== -1) {
                    const updated = [...prev];
                    updated[idx] = preview;
                    return updated;
                }
                return [preview, ...prev];
            });

            // ── 2. Increment unread (if conversation not open) ───────────────
            if (!isActiveThread) {
                setUnreadCounts((prev) => {
                    const next = new Map(prev);
                    next.set(partnerId, (next.get(partnerId) ?? 0) + 1);
                    return next;
                });
            }

            // ── 3. Append to message list (only for active thread) ───────────
            setMessages((prev) => {
                if (!isActiveThread) return prev;

                // Replace optimistic bubble if present
                const matchOptimisticIndex = prev.findIndex((m: any) =>
                    m?.optimistic === true &&
                    m?.sender_id === normalized.sender_id &&
                    m?.receiver_id === normalized.receiver_id &&
                    m?.message === normalized.message
                );
                if (matchOptimisticIndex !== -1) {
                    const next = [...prev];
                    next[matchOptimisticIndex] = { ...normalized, optimistic: false, tempId: undefined };
                    return next;
                }

                if (prev.some((m) => m.id === incomingId)) return prev;
                return [...prev, normalized];
            });
        };

        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        socket.on('typing', handleTyping);
        socket.on('stopTyping', handleStopTyping);
        socket.on('newMessage', handleNewMessage);

        return () => {
            socket.off('connect', handleConnect);
            socket.off('disconnect', handleDisconnect);
            socket.off('typing', handleTyping);
            socket.off('stopTyping', handleStopTyping);
            socket.off('newMessage', handleNewMessage);
            socket.disconnect();
            socketRef.current = null;
        };
    }, []);


    const loadMsgs = useCallback(async (id: number) => {
        const res = await serviceApi.getMessages(id);
        if (!res.error) setMessages(res.data ?? []);
    }, []);

    useEffect(() => {
        selectedIdRef.current = selected?.id ?? null;
        if (!selected) return;
        // Clear unread badge when opening a conversation
        setUnreadCounts((prev) => {
            if (!prev.has(selected.id)) return prev;
            const next = new Map(prev);
            next.delete(selected.id);
            return next;
        });
        setMLoading(true);
        loadMsgs(selected.id).finally(() => setMLoading(false));
        pollRef.current = null;
        if (pollRef.current) clearInterval(pollRef.current);
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [selected, loadMsgs]);

    // Partner-request gating for USER → PROVIDER conversations.
    // Prefer the request_status already returned with the contact list; fall
    // back to the API only if it isn't present (e.g. direct deep-link).
    useEffect(() => {
        if (!selected || isProvider) {
            setPartnerLocked(false);
            return;
        }
        let cancelled = false;
        setPartnerChecking(true);
        setPartnerLocked(false);

        if (selected.request_status) {
            setPartnerLocked(selected.request_status !== 'accepted');
            setPartnerChecking(false);
            return;
        }

        (async () => {
            const res = await userApi.getPartnerRequestStatus(selected.id);
            if (cancelled) return;
            const status = res.data?.status ?? null;
            setPartnerLocked(status !== 'accepted');
            setPartnerChecking(false);
        })();
        return () => { cancelled = true; };
    }, [selected, isProvider]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);


    const send = async () => {
        const txt = input.trim();
        if (!txt || !selected || sending) return;
        setSending(true);

        // Capture receiver id before we clear state
        const receiverId = selected.id;

        setInput('');

        // Optimistic UI (keep it, but mark it so we can replace it when the socket event arrives)
        const optId = Date.now();
        const tempId = `temp_${optId}_${Math.random().toString(16).slice(2)}`;
        const opt: ChatMessage = {
            id: optId,
            sender_id: myId ?? 0,
            receiver_id: receiverId,
            message: txt,
            created_at: new Date().toISOString(),
            sender_name: myName,
            // Mark for replacement when the socket-persisted message arrives
            optimistic: true,
            tempId,
        } as any;

        const exists = lastSocketMessageIdsRef.current.has(optId);
        if (!exists) setMessages((p) => [...p, opt]);

        // Socket emit
        socketRef.current?.emit('sendMessage', { receiver_id: receiverId, message: txt });
        socketRef.current?.emit('stopTyping', { receiver_id: receiverId });

        // REST persistence (without re-fetch)
        await serviceApi.sendMessage(receiverId, txt);

        setShowTyping(false);
        setSending(false);
        textRef.current?.focus();
    };

    // Typing indicator helpers (backend contract: { receiver_id })

    const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const emitTypingNow = (receiverId: number) => {
        if (!receiverId) return;
        socketRef.current?.emit('typing', { receiver_id: receiverId });
        // debounce stopTyping after last keystroke
        if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
        typingDebounceRef.current = setTimeout(() => {
            socketRef.current?.emit('stopTyping', { receiver_id: receiverId });
        }, 700);
    };

    const onKey = (e: React.KeyboardEvent) => {
        if (!selected) return;
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
            return;
        }

        // While typing (except Enter-send), debounce typing events
        emitTypingNow(selected.id);
    };

    const filtered = contacts.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));




    return (
        <>
            <style>{STYLE}</style>
            <TopNav />
            {/* Providers always get chat access — it's their work inbox.
                Users are gated behind Silver membership. */}
            <FeatureGate feature="CHAT" fullPage requiredTier="Silver" providerBypass={isProvider}>
                <div style={{
                    position: 'fixed',
                    top: 64,
                    bottom: 64,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '100%',
                    maxWidth: 480,
                    display: 'flex',
                    flexDirection: 'column',
                    background: '#080d1a',
                    overflow: 'hidden',
                    zIndex: 100,
                }}>

                    {!selected ? (
                        /* ══════════════ CONTACTS ══════════════ */
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, animation: 'slideUp .3s ease' }}>
                            {/* Header */}
                            <div style={{ padding: '20px 18px 0', background: 'linear-gradient(180deg,#080d1a 70%,transparent)', flexShrink: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                                    <div>
                                        <h1 style={{ color: '#fff', fontSize: '1.55rem', fontWeight: 800, letterSpacing: '-0.03em', margin: 0 }}>Messages</h1>
                                        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem', marginTop: 2 }}>{filtered.length} {isProvider ? 'users' : 'providers'} available</p>
                                    </div>
                                    {/* compose icon */}
                                    <div style={{ width: 38, height: 38, borderRadius: 12, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(99,102,241,0.5)', cursor: 'pointer' }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                                    </div>
                                </div>
                                {/* search */}
                                <div style={{ position: 'relative', marginBottom: 14 }}>
                                    <svg style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', opacity: 0.35, pointerEvents: 'none' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
                                        style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 14, color: '#fff', padding: '11px 14px 11px 38px', fontSize: '0.88rem', outline: 'none', fontFamily: "'Inter',sans-serif", backdropFilter: 'blur(8px)' }} />
                                </div>
                                <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.12em', marginBottom: 6 }}>ONLINE NOW</p>
                            </div>

                            {/* list */}
                            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '0 10px 8px' }}>
                                {cLoading ? (
                                    <div style={{ textAlign: 'center', padding: '50px 0' }}>
                                        {[0, 1, 2].map(i => (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', marginBottom: 4 }}>
                                                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', animation: 'pulse 1.4s ease infinite' }} />
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.07)', marginBottom: 8, width: '55%', animation: 'pulse 1.4s ease infinite' }} />
                                                    <div style={{ height: 10, borderRadius: 6, background: 'rgba(255,255,255,0.04)', width: '35%', animation: 'pulse 1.4s ease infinite' }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : filtered.length === 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: 10 }}>
                                        <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(99,102,241,0.6)" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                                        </div>
                                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem', textAlign: 'center' }}>No contacts online right now</p>
                                    </div>
                                ) : filtered.map((c, idx) => {
                                    const unread = unreadCounts.get(c.id) ?? 0;
                                    const preview = (c as any).latestMessage as string | undefined;
                                    return (
                                    <button key={c.id} onClick={() => setSelected(c)}
                                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 13, background: 'transparent', border: 'none', padding: '10px 8px', cursor: 'pointer', borderRadius: 16, marginBottom: 2, animation: `slideUp .3s ease ${idx * 0.04}s both`, textAlign: 'left', transition: 'background .15s' }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.1)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                    >
                                        <Av name={c.name} size={50} online={c.is_online === 1} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</p>
                                            {preview ? (
                                                <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: unread > 0 ? 700 : 400 }}>{preview}</p>
                                            ) : (
                                            <p style={{ fontSize: '0.72rem', color: c.is_online === 1 ? '#22c55e' : 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                {c.request_status === 'pending'
                                                    ? <><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 6px #f59e0b' }} />Request pending</>
                                                    : c.is_online === 1 ? <><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e', animation: 'pulse 2s ease infinite' }} />Online</> : c.last_seen ? `Last seen ${timeAgo(c.last_seen)}` : 'Offline'}
                                            </p>
                                            )}
                                        </div>
                                        {unread > 0 ? (
                                            <span style={{ minWidth: 20, height: 20, borderRadius: 999, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontSize: '0.65rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', flexShrink: 0, boxShadow: '0 0 10px rgba(99,102,241,0.6)' }}>{unread > 99 ? '99+' : unread}</span>
                                        ) : c.request_status === 'pending' ? (
                                            <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.04em', color: '#f59e0b', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', padding: '3px 8px', borderRadius: 999, flexShrink: 0 }}>PENDING</span>
                                        ) : null}
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                                    </button>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        /* ══════════════ THREAD ══════════════ */
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, animation: 'slideUp .25s ease' }}>
                            {/* thread header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(8,13,26,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
                                <button onClick={() => { setSelected(null); setMessages([]); }}
                                    style={{ width: 36, height: 36, borderRadius: 11, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .15s' }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.2)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
                                </button>
                                <Av name={selected.name} size={40} online={selected.is_online === 1} />
                                <div style={{ flex: 1 }}>
                                    <p style={{ color: '#fff', fontWeight: 700, fontSize: '0.97rem', marginBottom: 1 }}>{selected.name}</p>
                                    <p style={{ fontSize: '0.68rem', color: selected.is_online === 1 ? '#22c55e' : 'rgba(255,255,255,0.3)' }}>
                                        {selected.is_online === 1 ? '● Active now' : 'Offline'}
                                    </p>
                                </div>
                                <CallButton
                                    peerId={selected.id}
                                    peerName={selected.name}
                                    isOnline={selected.is_online === 1}
                                    canCall={!partnerLocked && hasFeature('AUDIO_CALL') && callState.status === 'idle'}
                                />
                                <button
                                    onClick={() => setShowHistory(true)}
                                    style={{
                                        width: 34,
                                        height: 34,
                                        borderRadius: 10,
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        background: 'rgba(255,255,255,0.04)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                        transition: 'all 0.15s',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.15)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                                    title="Call History"
                                >
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                                    </svg>
                                </button>
                                {/* info icon */}
                                <div style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                                </div>
                            </div>

                            {/* messages area */}
                            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 4, background: 'radial-gradient(ellipse at top,rgba(99,102,241,0.04) 0%,transparent 60%), #080d1a' }}>
                                {mLoading ? (
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            {[0, 1, 2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(99,102,241,0.6)', animation: `chatDot 1.2s ease ${i * 0.2}s infinite` }} />)}
                                        </div>
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                                        <div style={{ width: 72, height: 72, borderRadius: 24, background: `linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))`, border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(99,102,241,0.7)" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <p style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>Start a conversation</p>
                                            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.75rem' }}>Send a message to {selected.name}</p>
                                        </div>
                                    </div>
                                ) : (
                                    messages.map((msg, i) => {
                                        const isMe = msg.sender_id === myId;
                                        const newDay = i === 0 || fmtDate(msg.created_at) !== fmtDate(messages[i - 1].created_at);
                                        // show avatar on last message of a clump, for both sides
                                        const isLastInClump = i === messages.length - 1 || messages[i + 1]?.sender_id !== msg.sender_id;
                                        const clump = i > 0 && messages[i - 1].sender_id === msg.sender_id;
                                        return (
                                            <div key={msg.id}>
                                                {newDay && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0 8px' }}>
                                                        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
                                                        <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.25)', fontWeight: 600, letterSpacing: '0.06em' }}>{fmtDate(msg.created_at).toUpperCase()}</span>
                                                        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
                                                    </div>
                                                )}
                                                <div style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8, marginBottom: clump ? 2 : 6, animation: 'msgIn .25s ease' }}>

                                                    {/* Avatar slot — left for received, right for sent */}
                                                    <div style={{ width: 34, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                                        {isLastInClump && (
                                                            <>
                                                                <Av name={isMe ? myName : msg.sender_name} size={30} />
                                                                <span style={{ fontSize: '0.55rem', fontWeight: 700, color: isMe ? 'rgba(139,92,246,0.8)' : 'rgba(255,255,255,0.3)', letterSpacing: '0.05em' }}>
                                                                    {isMe ? 'YOU' : ini(msg.sender_name)}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>

                                                    {/* Bubble + timestamp */}
                                                    <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                                                        <div style={{
                                                            background: isMe ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'rgba(255,255,255,0.08)',
                                                            backdropFilter: !isMe ? 'blur(10px)' : undefined,
                                                            border: !isMe ? '1px solid rgba(255,255,255,0.07)' : 'none',
                                                            borderRadius: isMe ? (clump ? '18px 4px 4px 18px' : '18px 4px 18px 18px') : (clump ? '4px 18px 18px 4px' : '4px 18px 18px 18px'),
                                                            padding: '9px 14px',
                                                            boxShadow: isMe ? '0 4px 16px rgba(99,102,241,0.35)' : '0 1px 6px rgba(0,0,0,0.3)',
                                                        }}>
                                                            <p style={{ color: '#fff', fontSize: '0.9rem', lineHeight: 1.55, margin: 0, wordBreak: 'break-word' }}>{msg.message}</p>
                                                        </div>
                                                        <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)', marginTop: 3, paddingLeft: 4, paddingRight: 4 }}>
                                                            {fmtTime(msg.created_at)}{isMe && ' ✓✓'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                                {showTyping && (
                                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                                        <div style={{ width: 30 }} />
                                        <div style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '4px 18px 18px 18px' }}>
                                            <TypingDots />
                                        </div>
                                    </div>
                                )}
                                <div ref={bottomRef} />
                            </div>

                            {/* input bar */}
                            <div style={{ padding: '10px 12px', background: 'rgba(8,13,26,0.97)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
                                {partnerLocked ? (
                                    <div style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                        padding: '14px', borderRadius: 16, textAlign: 'center',
                                        background: 'rgba(99,102,241,0.06)', border: '1px dashed rgba(99,102,241,0.3)',
                                    }}>
                                        <span style={{ fontSize: 16 }}>🔒</span>
                                        <span style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 600, fontSize: '0.8rem' }}>
                                            {partnerChecking ? 'Checking request…' : 'Chat unlocks after the partner request is accepted'}
                                        </span>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20, padding: '6px 6px 6px 14px', transition: 'border-color .2s' }}
                                        onFocusCapture={e => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)')}
                                        onBlurCapture={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)')}
                                    >
                                        {/* emoji placeholder */}
                                        <button style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '1.1rem', padding: '2px 0', lineHeight: 1, flexShrink: 0 }}>😊</button>
                                        <textarea ref={textRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey}
                                            placeholder="Message…" rows={1}
                                            style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', resize: 'none', outline: 'none', fontFamily: "'Inter',sans-serif", fontSize: '0.9rem', lineHeight: 1.5, maxHeight: 110, overflowY: 'auto', paddingTop: 4, paddingBottom: 4 }}
                                        />
                                        {/* send btn */}
                                        <button onClick={send} disabled={!input.trim() || sending}
                                            style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', flexShrink: 0, cursor: !input.trim() || sending ? 'not-allowed' : 'pointer', background: input.trim() ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .2s', boxShadow: input.trim() ? '0 0 16px rgba(99,102,241,0.5)' : 'none' }}>
                                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(45deg)', marginLeft: -1 }}><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </FeatureGate>
            {showHistory && <CallHistoryPage onClose={() => setShowHistory(false)} />}
        </>
    );
}
