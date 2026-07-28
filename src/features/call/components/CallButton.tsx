import { useCallContext } from '../context/callContextValue';

interface CallButtonProps {
    peerId: number;
    peerName: string;
    isOnline: boolean;
    canCall: boolean;
    hasBalance: boolean;
}

export function CallButton({ peerId, peerName, isOnline, canCall, hasBalance }: CallButtonProps) {
    const { callState, startCall } = useCallContext();

    const baseVisible = canCall && isOnline && callState.status === 'idle';
    const disabled = baseVisible && !hasBalance;

    if (!baseVisible) return null;

    return (
        <button
            onClick={() => { if (hasBalance) startCall(peerId, peerName); }}
            disabled={disabled}
            title={disabled ? 'Insufficient Balance' : `Call ${peerName}`}
            style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                border: disabled
                    ? '1px solid rgba(239,68,68,0.25)'
                    : '1px solid rgba(34,197,94,0.25)',
                background: disabled
                    ? 'rgba(239,68,68,0.08)'
                    : 'rgba(34,197,94,0.1)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 0.15s',
                opacity: disabled ? 0.6 : 1,
            }}
            onMouseEnter={e => {
                if (!disabled) {
                    e.currentTarget.style.background = 'rgba(34,197,94,0.2)';
                    e.currentTarget.style.borderColor = 'rgba(34,197,94,0.5)';
                }
            }}
            onMouseLeave={e => {
                if (!disabled) {
                    e.currentTarget.style.background = 'rgba(34,197,94,0.1)';
                    e.currentTarget.style.borderColor = 'rgba(34,197,94,0.25)';
                }
            }}
        >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={disabled ? '#ef4444' : '#22c55e'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
        </button>
    );
}
