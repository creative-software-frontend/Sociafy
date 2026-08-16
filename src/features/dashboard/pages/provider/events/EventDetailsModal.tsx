import { useEffect, useState } from 'react';
import { eventApi } from '../../../../../utils/api';
import { formatEventDate, getStatusLabel, getStatusStyle, getCapacityText } from './utils/eventHelpers';
import type { Event, EventParticipant } from './types/event';
import { PointsDisplay } from '../../../../../components/PointsDisplay';

/* ---- Inline SVG icons (no icon library in the project) ---- */
const dIconProps = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
};

const DHostIcon = () => (<svg {...dIconProps}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>);
const DFeeIcon = () => (<svg {...dIconProps}><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>);
const DDeadlineIcon = () => (<svg {...dIconProps}><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></svg>);
const DCalendarIcon = () => (<svg {...dIconProps}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>);
const DPinIcon = () => (<svg {...dIconProps}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>);
const DUsersIcon = () => (<svg {...dIconProps}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>);

const dIconStyle: React.CSSProperties = { color: 'var(--gold-mid)', marginTop: 1, display: 'inline-flex', flexShrink: 0 };


interface EventDetailsModalProps {
    isOpen: boolean;
    event: Event | null;
    onClose: () => void;
    role: string;
}

export function EventDetailsModal({ isOpen, event, onClose, role }: EventDetailsModalProps) {
    const [participants, setParticipants] = useState<EventParticipant[]>([]);
    const [loadingParticipants, setLoadingParticipants] = useState(false);

    useEffect(() => {
        if (isOpen && event && role === 'provider') {
            setLoadingParticipants(true);
            eventApi.getParticipants(event.id).then(res => {
                if (!res.error && res.data) {
                    setParticipants(res.data);
                }
                setLoadingParticipants(false);
            });
        } else {
            setParticipants([]);
        }
    }, [isOpen, event, role]);

    if (!isOpen || !event) return null;

    const statusStyle = getStatusStyle(event.status);

    const isApplicationsClosed = !!event.application_deadline && new Date().getTime() > new Date(event.application_deadline).getTime();


    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            background: 'rgba(5, 8, 16, 0.85)',
            backdropFilter: 'blur(8px)'
        }}>
            <div style={{
                width: '100%',
                maxWidth: 480,
                maxHeight: '85svh',
                background: 'linear-gradient(135deg, rgba(11,21,45,0.98), rgba(7,16,32,0.98))',
                border: '1px solid var(--gold-border)',
                borderRadius: 'var(--radius-2xl)',
                padding: '24px 20px',
                boxShadow: '0 0 40px rgba(197,168,128,0.12), var(--shadow-lg)',
                display: 'flex',
                flexDirection: 'column',
                boxSizing: 'border-box',
                animation: 'fadeIn 0.25s ease'
            }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 16,
                    flexShrink: 0
                }}>
                    <span style={{
                        fontSize: '0.62rem',
                        letterSpacing: '0.1em',
                        background: isApplicationsClosed ? 'rgba(239,68,68,0.15)' : statusStyle.background,
                        border: isApplicationsClosed ? '1px solid rgba(239,68,68,0.4)' : statusStyle.border,
                        color: isApplicationsClosed ? '#f87171' : statusStyle.color,
                        padding: '3px 10px',
                        borderRadius: 20,
                        fontWeight: 700,
                        textTransform: 'uppercase'
                    }}>
                        {isApplicationsClosed ? 'Expired' : getStatusLabel(event.status)}
                    </span>

                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(197,168,128,0.08)',
                            border: '1px solid var(--gold-border)',
                            color: 'var(--gold-mid)',
                            fontSize: '1rem',
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s'
                        }}
                    >
                        ✕
                    </button>
                </div>

                <div style={{ overflowY: 'auto', flex: 1, paddingRight: 4, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                        <h2 style={{
                            color: 'var(--text-primary)',
                            fontSize: '1.3rem',
                            fontWeight: 800,
                            fontFamily: "'Inter', sans-serif",
                            margin: '0 0 8px 0',
                            lineHeight: 1.3
                        }}>
                            {event.title}
                        </h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: 0 }}>
                            Organized by: <strong style={{ color: 'var(--text-primary)' }}>{event.creator_name || 'Host'}</strong>
                        </p>
                    </div>

                    <div style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: 12,
                        padding: 14,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10
                    }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            <span style={dIconStyle}><DHostIcon /></span>
                            <div>
                                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>HOST</p>
                                <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 500 }}>{event.host_name || 'Host'}</p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            <span style={dIconStyle}><DFeeIcon /></span>
                            <div>
                                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>ENTRY FEE</p>
                                <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                                    {event.entry_fee === 0 ? 'Free' : <PointsDisplay amount={event.entry_fee ?? 0} />}
                                </p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            <span style={dIconStyle}><DDeadlineIcon /></span>
                            <div>
                                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>APPLICATION DEADLINE</p>
                                <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 500 }}>{event.application_deadline ? formatEventDate(event.application_deadline) : 'N/A'}</p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            <span style={dIconStyle}><DCalendarIcon /></span>
                            <div>
                                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>DATE & TIME</p>
                                <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 500 }}>{formatEventDate(event.date_time)}</p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            <span style={dIconStyle}><DPinIcon /></span>
                            <div>
                                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>LOCATION</p>
                                <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 500 }}>{event.location}</p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            <span style={dIconStyle}><DUsersIcon /></span>
                            <div>
                                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>AVAILABILITY</p>
                                <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 500 }}>{getCapacityText(event.participant_count, event.capacity)}</p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 700, margin: '0 0 6px 0', letterSpacing: '0.05em' }}>DESCRIPTION</h4>
                        <p style={{
                            color: 'var(--text-primary)',
                            fontSize: '0.9rem',
                            lineHeight: 1.6,
                            margin: 0,
                            background: 'rgba(0,0,0,0.15)',
                            padding: 12,
                            borderRadius: 8,
                            whiteSpace: 'pre-wrap'
                        }}>
                            {event.description || 'No additional details provided for this event.'}
                        </p>
                    </div>

                    {role === 'provider' && (
                        <div>
                            <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 700, margin: '0 0 8px 0', letterSpacing: '0.05em' }}>
                                PARTICIPANTS ({participants.length})
                            </h4>
                            {loadingParticipants ? (
                                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>Loading participants list...</p>
                            ) : participants.length === 0 ? (
                                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, padding: 8, border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 6, textAlign: 'center' }}>
                                    No participants have joined yet.
                                </p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 150, overflowY: 'auto' }}>
                                    {participants.map(p => (
                                        <div key={p.id} style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '8px 10px',
                                            background: 'rgba(255,255,255,0.03)',
                                            borderRadius: 8,
                                            border: '1px solid rgba(255,255,255,0.05)'
                                        }}>
                                            <div>
                                                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600 }}>{p.name}</p>
                                                <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--text-muted)' }}>{p.email}</p>
                                            </div>
                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                                Joined {new Date(p.joined_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div style={{ marginTop: 20, flexShrink: 0 }}>
                    <button
                        onClick={onClose}
                        style={{
                            width: '100%',
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 10,
                            color: 'var(--text-primary)',
                            padding: '10px 0',
                            fontSize: '0.88rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        Close Details
                    </button>
                </div>
            </div>
        </div>
    );
}
export default EventDetailsModal;
