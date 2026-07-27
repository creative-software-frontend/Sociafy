interface CallControlsProps {
    isMuted: boolean;
    isSpeakerOn: boolean;
    onToggleMute: () => void;
    onToggleSpeaker: () => void;
    onEnd: () => void;
}

const btnBase: React.CSSProperties = {
    width: 60,
    height: 60,
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
    flexShrink: 0,
    WebkitTapHighlightColor: 'transparent',
};

const labelStyle: React.CSSProperties = {
    color: 'rgba(255,255,255,0.4)',
    fontSize: '0.7rem',
    fontWeight: 600,
    letterSpacing: '0.06em',
    marginTop: 8,
    textAlign: 'center' as const,
};

function MicIcon({ muted }: { muted: boolean }) {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {muted ? (
                <>
                    <line x1="1" y1="1" x2="23" y2="23" />
                    <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
                    <path d="M15 9.34V5a3 3 0 0 0-5.94-.6" />
                    <path d="M17 16.95A7 7 0 0 1 5 12v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                </>
            ) : (
                <>
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                </>
            )}
        </svg>
    );
}

function SpeakerIcon({ on }: { on: boolean }) {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {on ? (
                <>
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                </>
            ) : (
                <>
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <line x1="23" y1="9" x2="17" y2="15" />
                    <line x1="17" y1="9" x2="23" y2="15" />
                </>
            )}
        </svg>
    );
}

export function CallControls({ isMuted, isSpeakerOn, onToggleMute, onToggleSpeaker, onEnd }: CallControlsProps) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 40,
            padding: '8px 16px',
        }}>
            {/* Mute */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <button
                    onClick={onToggleMute}
                    aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                    style={{
                        ...btnBase,
                        background: isMuted ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)',
                        color: isMuted ? '#ef4444' : 'rgba(255,255,255,0.8)',
                        border: isMuted ? '2px solid rgba(239,68,68,0.4)' : '2px solid rgba(255,255,255,0.1)',
                    }}
                    onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.92)'; }}
                    onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                    onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.92)'; }}
                    onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                    title={isMuted ? 'Unmute' : 'Mute'}
                >
                    <MicIcon muted={isMuted} />
                </button>
                <span style={labelStyle}>{isMuted ? 'UNMUTE' : 'MUTE'}</span>
            </div>

            {/* End Call */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <button
                    onClick={onEnd}
                    aria-label="End call"
                    style={{
                        ...btnBase,
                        width: 72,
                        height: 72,
                        background: '#ef4444',
                        color: '#fff',
                        boxShadow: '0 6px 28px rgba(239,68,68,0.5)',
                    }}
                    onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.92)'; }}
                    onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                    onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.92)'; }}
                    onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                    title="End call"
                >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(135deg)' }}>
                        <line x1="22" y1="2" x2="2" y2="22" />
                        <path d="M16 8A6 6 0 0 0 6 16" />
                    </svg>
                </button>
                <span style={labelStyle}>END</span>
            </div>

            {/* Speaker */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <button
                    onClick={onToggleSpeaker}
                    aria-label={isSpeakerOn ? 'Turn speaker off' : 'Turn speaker on'}
                    style={{
                        ...btnBase,
                        background: isSpeakerOn ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.08)',
                        color: isSpeakerOn ? '#3b82f6' : 'rgba(255,255,255,0.8)',
                        border: isSpeakerOn ? '2px solid rgba(59,130,246,0.4)' : '2px solid rgba(255,255,255,0.1)',
                    }}
                    onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.92)'; }}
                    onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                    onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.92)'; }}
                    onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                    title={isSpeakerOn ? 'Speaker off' : 'Speaker on'}
                >
                    <SpeakerIcon on={isSpeakerOn} />
                </button>
                <span style={labelStyle}>{isSpeakerOn ? 'SPEAKER' : 'SPEAKER'}</span>
            </div>
        </div>
    );
}
