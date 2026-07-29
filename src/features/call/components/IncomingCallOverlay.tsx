import { useRef } from 'react';
import { useCallContext } from '../context/callContextValue';

const GRAD = ['135deg,#6366f1,#8b5cf6', '135deg,#0ea5e9,#06b6d4', '135deg,#ec4899,#f472b6', '135deg,#10b981,#34d399', '135deg,#f59e0b,#fbbf24', '135deg,#ef4444,#f97316'];
function avatarGrad(n: string) {
    const s = n ?? ''; let h = 0;
    for (let i = 0; i < s.length; i++) h += s.charCodeAt(i);
    return GRAD[h % GRAD.length];
}
function initials(n: string) { return n ? n.slice(0, 2).toUpperCase() : '??'; }

const BG = 'radial-gradient(ellipse at 50% 30%, #0f1629 0%, #080d1a 50%, #040810 100%)';

export function IncomingCallOverlay() {
    const { callState, acceptCall, rejectCall } = useCallContext();
    const lockRef = useRef(false);

    const withLock = (fn: () => void) => () => {
        if (lockRef.current) return;
        lockRef.current = true;
        fn();
        setTimeout(() => { lockRef.current = false; }, 600);
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: BG, animation: 'fadeIn 0.25s ease',
            fontFamily: "'Inter', -apple-system, sans-serif",
            WebkitFontSmoothing: 'antialiased', overflow: 'hidden',
            padding: 'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)',
        }}>
            <style>{`
                @keyframes fadeIn{from{opacity:0}to{opacity:1}}
                @keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
                @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.7;transform:scale(1.04)}}
                @keyframes ringPulse{0%{box-shadow:0 0 0 0 rgba(99,102,241,0.4)}100%{box-shadow:0 0 0 32px rgba(99,102,241,0)}}
            `}</style>

            <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                flex: 1, gap: 32, padding: '40px 24px', width: '100%', maxWidth: 420, boxSizing: 'border-box',
            }}>
                {/* Avatar with ringing ring */}
                <div style={{ position: 'relative', animation: 'slideUp 0.35s ease' }}>
                    <div style={{
                        position: 'absolute', inset: -8, borderRadius: '50%',
                        animation: 'ringPulse 1.8s ease infinite',
                    }} />
                    <div style={{
                        width: 120, height: 120, borderRadius: '50%',
                        background: `linear-gradient(${avatarGrad(callState.peerName)})`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontWeight: 800, fontSize: 40,
                        fontFamily: "'Inter',sans-serif",
                        boxShadow: '0 0 0 6px rgba(99,102,241,0.2), 0 16px 48px rgba(0,0,0,0.5)',
                        animation: 'pulse 1.8s ease infinite',
                        flexShrink: 0, position: 'relative', zIndex: 1,
                    }}>
                        {initials(callState.peerName)}
                    </div>
                </div>

                {/* Info */}
                <div style={{ textAlign: 'center', animation: 'slideUp 0.35s ease 0.05s both' }}>
                    <h2 style={{ color: '#fff', fontSize: '1.75rem', fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.02em', lineHeight: 1.3 }}>
                        {callState.peerName}
                    </h2>
                    {callState.peerRole && (
                        <span style={{ display: 'inline-block', marginBottom: 6, padding: '2px 12px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                            {callState.peerRole.toUpperCase()}
                        </span>
                    )}
                    <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '1rem', margin: 0, fontWeight: 500 }}>
                        Incoming Audio Call
                    </p>
                </div>

                <div style={{ flex: 1, minHeight: 20 }} />

                {/* Action buttons */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 56, animation: 'slideUp 0.35s ease 0.1s both', paddingBottom: 8 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                        <button onClick={withLock(rejectCall)} aria-label="Decline call"
                            style={{
                                width: 64, height: 64, borderRadius: '50%', border: 'none',
                                background: '#ef4444', color: '#fff', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 6px 24px rgba(239,68,68,0.45)',
                                transition: 'transform 0.15s', WebkitTapHighlightColor: 'transparent',
                            }}
                            onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.92)'; }}
                            onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                            onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.92)'; }}
                            onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                            title="Decline">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em' }}>DECLINE</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                        <button onClick={withLock(acceptCall)} aria-label="Accept call"
                            style={{
                                width: 64, height: 64, borderRadius: '50%', border: 'none',
                                background: '#22c55e', color: '#fff', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 6px 24px rgba(34,197,94,0.45)',
                                transition: 'transform 0.15s', WebkitTapHighlightColor: 'transparent',
                            }}
                            onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.92)'; }}
                            onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                            onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.92)'; }}
                            onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                            title="Accept">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                            </svg>
                        </button>
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em' }}>ACCEPT</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
