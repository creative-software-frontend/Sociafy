import { useEffect, useState } from 'react';
import { TopNav } from './TopNav';
import { providerApi, userApi } from '../../../utils/api';
import { useAuth } from '../../../context/AuthContext';
import { PointsDisplay } from '../../../components/PointsDisplay';

interface EventItem {
    id?: number;
    title?: string;
    description?: string | null;
    date_time?: string;
    location: string;
    capacity?: number;
    status?: string;
    created_at?: string;
    host_name?: string | null;
    entry_fee?: number;
    participant_count?: number;
    event_count?: number;
    next_event?: string | null;
}

export function PlacesPage() {
    const { user } = useAuth();
    const isUser = user?.role === 'user';
    const [events, setEvents] = useState<EventItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const res = isUser ? await userApi.getEventLocations() : await providerApi.getAllEvents();
                if (res.error) setError(res.error);
                else setEvents(res.data || []);
            } catch (e: any) {
                setError(e?.message || 'Failed to load events');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [isUser]);

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    };

    const formatTime = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div style={{ background: 'var(--bg-root)', minHeight: '100svh', overflowX: 'hidden' }}>
            <TopNav />

            <div style={{
                padding: 'clamp(80px, 22vw, 100px) clamp(12px, 4vw, 16px) 16px',
                width: '100%',
                boxSizing: 'border-box',
            }}>
                <h2 style={{
                    fontSize: 'clamp(1.1rem, 5vw, 1.3rem)',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    fontFamily: "'Inter', sans-serif",
                    marginBottom: '4px',
                }}>
                    Places & Events
                </h2>
                <p style={{
                    color: 'var(--text-muted)',
                    fontSize: '0.75rem',
                    fontFamily: "'Inter', sans-serif",
                    marginBottom: '16px',
                }}>
                    Discover upcoming events by location
                </p>

                {loading && (
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
                        Loading events...
                    </p>
                )}

                {!loading && error && (
                    <p style={{ textAlign: 'center', color: 'var(--red-status)', padding: '40px 0' }}>
                        {error}
                    </p>
                )}

                {!loading && !error && events.length === 0 && (
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
                        No events available yet.
                    </p>
                )}

                {!loading && events.length > 0 && (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                        gap: '12px',
                    }}>
                        {events.map((ev, i) => (
                            <div
                                key={ev.id ?? i}
                                style={{
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    border: '1px solid var(--border-default)',
                                    position: 'relative',
                                    cursor: 'pointer',
                                    background: 'var(--bg-card)',
                                    boxShadow: '0 0 15px rgba(59,130,246,0.2)',
                                }}
                            >
                                <div style={{
                                    width: '100%',
                                    height: '120px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: 'linear-gradient(135deg, var(--bg-card-hover), var(--bg-card))',
                                    color: 'var(--text-secondary)',
                                }}>
                                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--blue-vivid)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 5px rgba(96,165,250,0.6))' }}>
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                        <circle cx="12" cy="10" r="3" />
                                    </svg>
                                </div>

                                {ev.status && (
                                    <span style={{
                                        position: 'absolute', top: '8px', right: '8px',
                                        background: ev.status === 'active' ? 'var(--green-status)' : 'var(--text-muted)',
                                        color: '#000',
                                        fontSize: '0.5rem', letterSpacing: '0.1em',
                                        textTransform: 'uppercase', padding: '3px 8px',
                                        borderRadius: '4px', fontFamily: "'Inter', sans-serif", fontWeight: 800,
                                    }}>
                                        {ev.status}
                                    </span>
                                )}

                                <div style={{ padding: '12px 10px' }}>
                                    <p style={{
                                        color: 'var(--text-primary)', fontSize: '0.82rem', fontWeight: 700,
                                        fontFamily: "'Inter', sans-serif", marginBottom: '6px',
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}>
                                        {ev.title ?? ev.location}
                                    </p>

                                    {/* Location name */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px' }}>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--blue-vivid)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                            <circle cx="12" cy="10" r="3" />
                                        </svg>
                                        <span style={{ color: 'var(--blue-vivid)', fontSize: '0.65rem', fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>
                                            {ev.location}
                                        </span>
                                    </div>

                                    {/* Date (provider events only) */}
                                    {ev.date_time && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                                <line x1="16" y1="2" x2="16" y2="6" />
                                                <line x1="8" y1="2" x2="8" y2="6" />
                                                <line x1="3" y1="10" x2="21" y2="10" />
                                            </svg>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.65rem', fontFamily: "'Inter', sans-serif" }}>
                                                {formatDate(ev.date_time)} • {formatTime(ev.date_time)}
                                            </span>
                                        </div>
                                    )}

                                    {/* Event count (user locations) */}
                                    {ev.event_count != null && (
                                        <p style={{
                                            color: 'var(--text-secondary)', fontSize: '0.6rem', fontWeight: 600,
                                            fontFamily: "'Inter', sans-serif", marginTop: '4px',
                                        }}>
                                            {ev.event_count} event{ev.event_count === 1 ? '' : 's'}
                                            {ev.next_event ? ` • next ${formatDate(ev.next_event)}` : ''}
                                        </p>
                                    )}

                                    {ev.entry_fee != null && ev.entry_fee > 0 && (
                                        <p style={{
                                            color: 'var(--gold-mid)', fontSize: '0.6rem', fontWeight: 700,
                                            fontFamily: "'Inter', sans-serif", marginTop: '6px',
                                        }}>
                                            <PointsDisplay amount={ev.entry_fee} decimals={2} /> entry
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default PlacesPage;
