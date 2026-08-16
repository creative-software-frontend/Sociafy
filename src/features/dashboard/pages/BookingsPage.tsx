import { useEffect, useState } from 'react';
import { TopNav } from './TopNav';
import { userApi } from '../../../utils/api';
import { PointsDisplay } from '../../../components/PointsDisplay';

interface JoinedEvent {
    id: number;
    title: string;
    description: string | null;
    date_time: string;
    location: string;
    capacity: number;
    status: string;
    host_name: string | null;
    entry_fee: number;
    created_at: string;
    participant_count: number;
}

export function BookingsPage() {
    const [events, setEvents] = useState<JoinedEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const res = await userApi.getJoinedEvents();
                if (res.error) setError(res.error);
                else setEvents(res.data || []);
            } catch (e: any) {
                setError(e?.message || 'Failed to load bookings');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

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
                    My Bookings
                </h2>
                <p style={{
                    color: 'var(--text-muted)',
                    fontSize: '0.75rem',
                    fontFamily: "'Inter', sans-serif",
                    marginBottom: '16px',
                }}>
                    Events you have joined
                </p>

                {loading && (
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
                        Loading bookings...
                    </p>
                )}

                {!loading && error && (
                    <p style={{ textAlign: 'center', color: 'var(--red-status)', padding: '40px 0' }}>
                        {error}
                    </p>
                )}

                {!loading && !error && events.length === 0 && (
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
                        You haven't joined any events yet.
                    </p>
                )}

                {!loading && events.length > 0 && (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                    }}>
                        {events.map(ev => (
                            <div
                                key={ev.id}
                                style={{
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    border: '1px solid var(--border-default)',
                                    background: 'var(--bg-card)',
                                    boxShadow: '0 0 15px rgba(59,130,246,0.2)',
                                    padding: '14px',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                    <p style={{
                                        color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: 700,
                                        fontFamily: "'Inter', sans-serif", marginBottom: '4px',
                                    }}>
                                        {ev.title}
                                    </p>
                                    <span style={{
                                        background: ev.status === 'active' ? 'var(--green-status)' : 'var(--text-muted)',
                                        color: '#000',
                                        fontSize: '0.5rem', letterSpacing: '0.1em',
                                        textTransform: 'uppercase', padding: '3px 8px',
                                        borderRadius: '4px', fontFamily: "'Inter', sans-serif", fontWeight: 800,
                                        flexShrink: 0, marginLeft: '8px',
                                    }}>
                                        {ev.status}
                                    </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--blue-vivid)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                        <circle cx="12" cy="10" r="3" />
                                    </svg>
                                    <span style={{ color: 'var(--blue-vivid)', fontSize: '0.7rem', fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>
                                        {ev.location}
                                    </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                        <line x1="16" y1="2" x2="16" y2="6" />
                                        <line x1="8" y1="2" x2="8" y2="6" />
                                        <line x1="3" y1="10" x2="21" y2="10" />
                                    </svg>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', fontFamily: "'Inter', sans-serif" }}>
                                        {formatDate(ev.date_time)} • {formatTime(ev.date_time)}
                                    </span>
                                </div>

                                <div style={{ display: 'flex', gap: '12px', fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: "'Inter', sans-serif" }}>
                                    {ev.entry_fee > 0 && <span><PointsDisplay amount={ev.entry_fee} decimals={2} /> entry</span>}
                                    <span>{ev.participant_count} joined</span>
                                    {ev.host_name && <span>Host: {ev.host_name}</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default BookingsPage;
