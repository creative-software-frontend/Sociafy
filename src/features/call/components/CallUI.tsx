import { useEffect, useRef } from 'react';
import { useCallContext } from '../context/callContextValue';
import { useAuth } from '../../../context/AuthContext';
import { CallTimer } from './CallTimer';
import { CallControls } from './CallControls';

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

function StatusLabel({ status, error }: { status: string; error?: string | null }) {
    const labels: Record<string, string> = {
        calling: 'Calling...',
        ringing: 'Ringing...',
        connecting: 'Connecting...',
        connected: '',
        ended: 'Call Ended',
        busy: 'User is Busy',
        rejected: 'Call Rejected',
        cancelled: 'Call Cancelled',
        missed: 'Missed Call',
        error: error || 'Call Failed',
    };
    return (
        <p style={{
            color: status === 'error' ? '#ef4444' : 'rgba(255,255,255,0.5)',
            fontSize: status === 'error' ? '0.85rem' : '1rem',
            fontWeight: 500,
            margin: 0,
            letterSpacing: '0.02em',
        }}>
            {labels[status] || status}
        </p>
    );
}

const CALL_BG = 'radial-gradient(ellipse at 50% 0%, #0f1629 0%, #080d1a 60%, #040810 100%)';

export function CallUI() {
    const { callState, peerStream, toggleMute, toggleSpeaker, endCall, cancelCall, isMuted, isSpeakerOn } = useCallContext();
    const { user } = useAuth();
    const audioRef = useRef<HTMLAudioElement>(null);
    const startedAtRef = useRef<number | null>(null);
    const actionLockRef = useRef(false);

    useEffect(() => {
        if (callState.status === 'connected' && startedAtRef.current === null) {
            startedAtRef.current = Date.now();
        }
        if (callState.status === 'idle') {
            startedAtRef.current = null;
            actionLockRef.current = false;
        }
    }, [callState.status]);

    useEffect(() => {
        if (audioRef.current && peerStream) {
            audioRef.current.srcObject = peerStream;
        }
    }, [peerStream]);

    // Escape key ends or cancels call
    useEffect(() => {
        if (callState.status === 'idle') return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                const active = ['calling', 'ringing'].includes(callState.status);
                if (active) cancelCall();
                else if (callState.status === 'connected') endCall();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [callState.status, cancelCall, endCall]);

    // Prevent accidental double taps
    const withLock = (fn: () => void) => () => {
        if (actionLockRef.current) return;
        actionLockRef.current = true;
        fn();
        setTimeout(() => { actionLockRef.current = false; }, 600);
    };

    const peerRole = callState.peerRole
        || (callState.direction === 'outgoing'
            ? (user?.role === 'user' ? 'Provider' : 'User')
            : null);

    const isPreConnection = ['calling', 'ringing'].includes(callState.status);
    const isTerminal = ['ended', 'busy', 'rejected', 'cancelled', 'missed'].includes(callState.status);
    const isConnecting = callState.status === 'connecting';

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9998,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: CALL_BG,
            animation: 'fadeIn 0.25s ease',
            fontFamily: "'Inter', -apple-system, sans-serif",
            WebkitFontSmoothing: 'antialiased',
            overflow: 'hidden',
            padding: 'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)',
        }}>
            <style>{`
                @keyframes fadeIn{from{opacity:0}to{opacity:1}}
                @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.7;transform:scale(1.04)}}
                @keyframes ripple{0%{box-shadow:0 0 0 0 rgba(239,68,68,0.5)}100%{box-shadow:0 0 0 24px rgba(239,68,68,0)}}
            `}</style>

            <audio ref={audioRef} autoPlay playsInline />

            {/* ════ Main content ════ */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                gap: 24,
                padding: '40px 24px',
                width: '100%',
                maxWidth: 420,
                boxSizing: 'border-box',
            }}>
                {/* ─── Avatar ─── */}
                <div style={{
                    width: isPreConnection ? 128 : 112,
                    height: isPreConnection ? 128 : 112,
                    borderRadius: '50%',
                    background: `linear-gradient(${avatarGrad(callState.peerName)})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: isPreConnection ? 42 : 36,
                    fontFamily: "'Inter',sans-serif",
                    boxShadow: isPreConnection
                        ? '0 0 0 6px rgba(99,102,241,0.25), 0 12px 48px rgba(0,0,0,0.5)'
                        : '0 12px 48px rgba(0,0,0,0.5)',
                    animation: isPreConnection ? 'pulse 1.6s ease infinite' : undefined,
                    flexShrink: 0,
                }}>
                    {initials(callState.peerName)}
                </div>

                {/* ─── Name + Role ─── */}
                <div style={{ textAlign: 'center' }}>
                    <h2 style={{
                        color: '#fff',
                        fontSize: '1.65rem',
                        fontWeight: 700,
                        margin: 0,
                        letterSpacing: '-0.02em',
                        lineHeight: 1.3,
                    }}>
                        {callState.peerName}
                    </h2>
                    {peerRole && (
                        <span style={{
                            display: 'inline-block',
                            marginTop: 4,
                            padding: '2px 12px',
                            borderRadius: 999,
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            letterSpacing: '0.06em',
                            color: 'rgba(255,255,255,0.45)',
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.08)',
                        }}>
                            {peerRole.toUpperCase()}
                        </span>
                    )}
                </div>

                {/* ─── Status / Timer ─── */}
                {isConnecting ? (
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        {[0, 1, 2].map(i => (
                            <div key={i} style={{
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                background: 'rgba(99,102,241,0.5)',
                                animation: `pulse 1.2s ease ${i * 0.2}s infinite`,
                            }} />
                        ))}
                    </div>
                ) : callState.status === 'connected' || callState.status === 'ended' ? (
                    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <CallTimer startedAt={startedAtRef.current} />
                        {callState.status === 'ended' && (
                            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', fontWeight: 500 }}>
                                Call Ended
                            </span>
                        )}
                    </div>
                ) : (
                    <StatusLabel status={callState.status} error={callState.error} />
                )}

                {/* ─── Spacer ─── */}
                <div style={{ flex: 1, minHeight: 20 }} />

                {/* ─── Action button ─── */}
                {isPreConnection && (
                    <button
                        onClick={withLock(cancelCall)}
                        aria-label="Cancel call"
                        style={{
                            width: 72,
                            height: 72,
                            borderRadius: '50%',
                            border: 'none',
                            background: '#ef4444',
                            color: '#fff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 6px 28px rgba(239,68,68,0.5)',
                            transition: 'transform 0.15s, box-shadow 0.15s',
                            animation: 'ripple 2s ease infinite',
                            flexShrink: 0,
                            WebkitTapHighlightColor: 'transparent',
                        }}
                        onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.92)'; }}
                        onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                        onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.92)'; }}
                        onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                        title="Cancel call"
                    >
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(135deg)' }}>
                            <line x1="22" y1="2" x2="2" y2="22" />
                            <path d="M16 8A6 6 0 0 0 6 16" />
                        </svg>
                    </button>
                )}

                {callState.status === 'connected' && (
                    <CallControls
                        isMuted={isMuted}
                        isSpeakerOn={isSpeakerOn}
                        onToggleMute={toggleMute}
                        onToggleSpeaker={toggleSpeaker}
                        onEnd={endCall}
                    />
                )}

                {isTerminal && (
                    <span style={{
                        color: 'rgba(255,255,255,0.25)',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        letterSpacing: '0.02em',
                    }}>
                        Closing...
                    </span>
                )}
            </div>
        </div>
    );
}
