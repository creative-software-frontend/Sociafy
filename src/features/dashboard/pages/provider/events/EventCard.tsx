import { formatEventDate, getStatusLabel, getStatusStyle, getCapacityText, isEventFull } from './utils/eventHelpers';

import type { Event } from './types/event';
import { PointsDisplay } from '../../../../../components/PointsDisplay';

interface EventCardProps {
    event: Event;
    role: string;
    currentUserId: number;
    actionLoading: number | null;
    onJoin: (id: number) => void;
    onLeave: (id: number) => void;
    onEdit: (event: Event) => void;
    onDelete: (id: number) => void;
    onViewDetails: (event: Event) => void;
}

/* ---- Inline SVG icons (no icon library in the project) ---- */
const iconProps = {
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
};

const HostIcon = () => (
    <svg {...iconProps}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
);

const FeeIcon = () => (
    <svg {...iconProps}><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
);

const DeadlineIcon = () => (
    <svg {...iconProps}><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></svg>
);

const CalendarIcon = () => (
    <svg {...iconProps}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
);

const PinIcon = () => (
    <svg {...iconProps}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
);

const metaRowStyle: React.CSSProperties = {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    fontSize: '0.76rem',
    color: 'var(--text-secondary)',
};

const metaIconStyle: React.CSSProperties = {
    color: 'var(--gold-mid)',
    display: 'inline-flex',
    flexShrink: 0,
};

export function EventCard({
    event,
    role,
    currentUserId,
    actionLoading,
    onJoin,
    onLeave,
    onEdit,
    onDelete,
    onViewDetails
}: EventCardProps) {
    const isCreator = event.creator_id === currentUserId;
    const hasJoined = event.joined === 1;
    const isFull = isEventFull(event.participant_count, event.capacity);
    const isLoading = actionLoading === event.id;

    const isApplicationsClosed = !!event.application_deadline && new Date().getTime() > new Date(event.application_deadline).getTime();

    const statusStyle = getStatusStyle(event.status);


    return (
        <div style={{
            background: 'linear-gradient(135deg, rgba(11,21,45,0.92), rgba(7,16,32,0.92))',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-xl)',
            padding: 18,
            boxShadow: 'var(--shadow-md)',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            transition: 'transform 0.2s, border-color 0.2s, box-shadow 0.2s',
            cursor: 'pointer'
        }}
        onClick={() => onViewDetails(event)}
        onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--gold-border)';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 0 24px rgba(197,168,128,0.12)';
        }}
        onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--border-subtle)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'var(--shadow-md)';
        }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <span style={{
                    fontSize: '0.58rem',
                    letterSpacing: '0.08em',
                    background: statusStyle.background,
                    border: statusStyle.border,
                    color: statusStyle.color,
                    padding: '3px 10px',
                    borderRadius: 20,
                    fontWeight: 700,
                    textTransform: 'uppercase'
                }}>
                    {getStatusLabel(event.status)}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {getCapacityText(event.participant_count, event.capacity)}
                </span>
            </div>

            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: '10px 12px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
            }}>
                <div style={metaRowStyle}>
                    <span style={metaIconStyle}><HostIcon /></span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {event.host_name || 'Host'}
                    </span>
                </div>

                <div style={metaRowStyle}>
                    <span style={metaIconStyle}><FeeIcon /></span>
                    <span>
                        {event.entry_fee === 0 ? 'Free' : <PointsDisplay amount={event.entry_fee ?? 0} />}
                    </span>
                </div>

                <div style={metaRowStyle}>
                    <span style={metaIconStyle}><DeadlineIcon /></span>
                    <span>{event.application_deadline ? formatEventDate(event.application_deadline) : 'N/A'}</span>
                </div>
            </div>


            <div>
                <h3 style={{
                    color: 'var(--text-primary)',
                    fontSize: '0.98rem',
                    fontWeight: 800,
                    margin: '0 0 4px 0',
                    fontFamily: "'Inter', sans-serif"
                }}>
                    {event.title}
                </h3>
                {event.description && (
                    <p style={{
                        color: 'var(--text-secondary)',
                        fontSize: '0.82rem',
                        lineHeight: 1.4,
                        margin: 0,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                    }}>
                        {event.description}
                    </p>
                )}
            </div>

            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: '10px 12px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
            }}>
                <div style={metaRowStyle}>
                    <span style={metaIconStyle}><CalendarIcon /></span>
                    <span>{formatEventDate(event.date_time)}</span>
                </div>
                <div style={{ ...metaRowStyle, minWidth: 0 }}>
                    <span style={metaIconStyle}><PinIcon /></span>
                    <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {event.location}
                    </span>
                </div>
            </div>

            <div
                style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 8,
                    marginTop: 2,
                    flexWrap: 'wrap'
                }}
                onClick={e => e.stopPropagation()} // prevent triggering modal open
            >
                {role === 'provider' && isCreator ? (
                    <>
                        <button
                            onClick={() => onEdit(event)}
                            style={{
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid var(--border-default)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--text-primary)',
                                padding: '7px 14px',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            Edit
                        </button>
                        <button
                            onClick={() => onDelete(event.id)}
                            disabled={isLoading}
                            style={{
                                background: 'rgba(239,68,68,0.1)',
                                border: '1px solid rgba(239,68,68,0.3)',
                                borderRadius: 'var(--radius-md)',
                                color: '#f87171',
                                padding: '7px 14px',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                cursor: isLoading ? 'wait' : 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            Delete
                        </button>
                    </>
                ) : role === 'user' ? (
                    event.status === 'active' && (
                        hasJoined ? (
                            <button
                                onClick={() => onLeave(event.id)}
                                disabled={isLoading}
                                style={{
                                    background: 'rgba(239,68,68,0.1)',
                                    border: '1px solid rgba(239,68,68,0.3)',
                                    borderRadius: 'var(--radius-md)',
                                    color: '#f87171',
                                    padding: '7px 14px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    cursor: isLoading ? 'wait' : 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {isLoading ? 'Leaving...' : 'Leave Event'}
                            </button>
                        ) : (
                            <>
                                {isApplicationsClosed && (
                                    <span style={{
                                        background: 'rgba(239,68,68,0.15)',
                                        border: '1px solid rgba(239,68,68,0.35)',
                                        color: '#f87171',
                                        padding: '2px 8px',
                                        borderRadius: 20,
                                        fontSize: '0.7rem',
                                        fontWeight: 800,
                                        textTransform: 'uppercase'
                                    }}>
                                        Applications Closed
                                    </span>
                                )}
                                <button
                                    onClick={() => onJoin(event.id)}
                                    disabled={isLoading || isFull || isApplicationsClosed}
                                    style={{
                                        background: isFull || isApplicationsClosed ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, var(--gold-rich), var(--gold-deep))',
                                        border: isFull || isApplicationsClosed ? '1px solid var(--border-default)' : '1px solid var(--gold-border)',
                                        borderRadius: 'var(--radius-md)',
                                        color: isFull || isApplicationsClosed ? 'var(--text-muted)' : '#0b0f1a',
                                        padding: '8px 16px',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        cursor: isLoading || isFull || isApplicationsClosed ? 'not-allowed' : 'pointer',
                                        boxShadow: isFull || isApplicationsClosed ? 'none' : '0 0 14px rgba(197,168,128,0.25)',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {isLoading ? 'Joining...' : isApplicationsClosed ? 'Applications Closed' : isFull ? 'Event Full' : 'Join Event'}
                                </button>
                            </>
                        )
                    )
                ) : null}


                <button
                    onClick={() => onViewDetails(event)}
                    style={{
                        background: 'rgba(197,168,128,0.08)',
                        border: '1px solid var(--gold-border)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--gold-mid)',
                        padding: '7px 14px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    Details
                </button>
            </div>
        </div>
    );
}
export default EventCard;
