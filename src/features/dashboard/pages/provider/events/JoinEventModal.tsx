import { useState } from 'react';
import { motion } from 'framer-motion';
import { useToast } from '../../../../../components/Toast';
import { formatEventDate } from './utils/eventHelpers';
import type { Event } from './types/event';
import { PointsDisplay } from '../../../../../components/PointsDisplay';

interface JoinEventModalProps {
    isOpen: boolean;
    event: Event | null;
    onClose: () => void;
    onJoin: (eventId: number) => Promise<{ error?: string } | unknown>;
    onSuccess?: () => void;
}

export function JoinEventModal({
    isOpen,
    event,
    onClose,
    onJoin,
    onSuccess,
}: JoinEventModalProps) {
    const toast = useToast();
    const [loading, setLoading] = useState(false);

    if (!isOpen || !event) return null;

    const entryFee = Number(event.entry_fee || 0);

    const handleJoin = async () => {
        // Prevent double submission while the request is pending.
        if (loading) return;
        setLoading(true);
        try {
            const res = (await onJoin(event.id)) as { error?: string } | undefined;
            if (res && 'error' in res && res.error) {
                toast.error(res.error);
                return; // keep modal open so the user can retry
            }
            toast.success('Successfully joined the event.');
            onSuccess?.();
            onClose();
        } catch (err) {
            const message =
                err && typeof err === 'object' && 'message' in err
                    ? String((err as { message: unknown }).message)
                    : 'Unable to join event.';
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'var(--bg-overlay)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 99999,
                padding: '20px',
            }}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="card gold-top-edge"
                style={{ width: '100%', maxWidth: '440px', position: 'relative' }}
            >
                {/* Header */}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '16px',
                    }}
                >
                    <h3
                        style={{
                            fontSize: '1.25rem',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            margin: '0 0 4px 0',
                        }}
                    >
                        Join Event
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="btn btn-ghost btn-sm"
                        style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>

                <p
                    style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-secondary)',
                        margin: '0 0 16px 0',
                    }}
                >
                    Are you sure you want to join this event?
                </p>

                {/* Event summary */}
                <div
                    style={{
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '16px 20px',
                        marginBottom: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                        <span
                            style={{
                                fontSize: '0.72rem',
                                color: 'var(--text-muted)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                                fontWeight: 600,
                                flexShrink: 0,
                            }}
                        >
                            Event
                        </span>
                        <span
                            style={{
                                fontSize: '0.9rem',
                                color: 'var(--text-primary)',
                                fontWeight: 600,
                                textAlign: 'right',
                            }}
                        >
                            {event.title}
                        </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                        <span
                            style={{
                                fontSize: '0.72rem',
                                color: 'var(--text-muted)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                                fontWeight: 600,
                                flexShrink: 0,
                            }}
                        >
                            Date
                        </span>
                        <span
                            style={{
                                fontSize: '0.85rem',
                                color: 'var(--text-secondary)',
                                textAlign: 'right',
                            }}
                        >
                            {formatEventDate(event.date_time)}
                        </span>
                    </div>
                    {event.location ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                            <span
                                style={{
                                    fontSize: '0.72rem',
                                    color: 'var(--text-muted)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.1em',
                                    fontWeight: 600,
                                    flexShrink: 0,
                                }}
                            >
                                Location
                            </span>
                            <span
                                style={{
                                    fontSize: '0.85rem',
                                    color: 'var(--text-secondary)',
                                    textAlign: 'right',
                                }}
                            >
                                {event.location}
                            </span>
                        </div>
                    ) : null}
                    {entryFee > 0 ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                            <span
                                style={{
                                    fontSize: '0.72rem',
                                    color: 'var(--text-muted)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.1em',
                                    fontWeight: 600,
                                    flexShrink: 0,
                                }}
                            >
                                Entry Fee
                            </span>
                            <span
                                style={{
                                    fontSize: '0.85rem',
                                    color: 'var(--gold-mid)',
                                    fontWeight: 700,
                                    textAlign: 'right',
                                }}
                            >
                                <PointsDisplay amount={entryFee} />
                            </span>
                        </div>
                    ) : null}
                </div>

                {entryFee > 0 ? (
                    <p
                        style={{
                            fontSize: '0.78rem',
                            color: 'var(--text-muted)',
                            margin: '0 0 16px 0',
                        }}
                    >
                        This amount will be deducted from your wallet upon joining.
                    </p>
                ) : null}

                {/* Actions */}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="btn btn-ghost btn-sm"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleJoin}
                        disabled={loading}
                        className="btn btn-primary btn-sm"
                    >
                        {loading ? 'Joining...' : 'Join Event'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

export default JoinEventModal;
