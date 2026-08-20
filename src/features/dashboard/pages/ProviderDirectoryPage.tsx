import { useEffect, useState } from 'react';
import { TopNav } from './TopNav';
import { providerApi, userApi } from '../../../utils/api';
import { useAuth } from '../../../context/AuthContext';

interface ProviderProfile {
    id: number;
    name: string;
    avatar_url: string | null;
    profession: string | null;
    location: string | null;
    interests: string | null;
}

export function ProviderDirectoryPage() {
    const { user } = useAuth();
    const isUser = user?.role === 'user';
    const [providers, setProviders] = useState<ProviderProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const res = isUser ? await userApi.getProviders() : await providerApi.getProviders();
                if (res.error) setError(res.error);
                else setProviders(res.data || []);
            } catch (e: any) {
                setError(e?.message || 'Failed to load providers');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [isUser]);

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
                    Provider Directory
                </h2>
                <p style={{
                    color: 'var(--text-muted)',
                    fontSize: '0.75rem',
                    fontFamily: "'Inter', sans-serif",
                    marginBottom: '16px',
                }}>
                    Browse verified provider profiles
                </p>

                {loading && (
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
                        Loading providers...
                    </p>
                )}

                {!loading && error && (
                    <p style={{ textAlign: 'center', color: 'var(--red-status)', padding: '40px 0' }}>
                        {error}
                    </p>
                )}

                {!loading && !error && providers.length === 0 && (
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
                        No providers available yet.
                    </p>
                )}

                {!loading && providers.length > 0 && (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '12px',
                    }}>
                        {providers.map(p => (
                            <div
                                key={p.id}
                                style={{
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    border: '1.5px solid var(--border-subtle)',
                                    position: 'relative',
                                    cursor: 'pointer',
                                    background: 'var(--bg-card)',
                                }}
                            >
                                {p.avatar_url ? (
                                    <img src={p.avatar_url} alt={p.name} style={{
                                        width: '100%', height: '170px', objectFit: 'cover', display: 'block',
                                    }} />
                                ) : (
                                    <div style={{
                                        width: '100%', height: '170px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        background: 'linear-gradient(135deg, var(--bg-card-hover), var(--bg-card))',
                                        color: 'var(--text-secondary)', fontSize: '2rem', fontWeight: 700,
                                    }}>
                                        {p.name ? p.name.substring(0, 2).toUpperCase() : '?'}
                                    </div>
                                )}

                                <div style={{
                                    position: 'absolute', bottom: 0, left: 0, right: 0,
                                    background: 'linear-gradient(transparent, var(--bg-nav))',
                                    padding: '20px 10px 10px',
                                }}>
                                    <p style={{ color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 600, fontFamily: "'Inter', sans-serif", marginBottom: '2px' }}>{p.name}</p>
                                    <div style={{ display: 'flex', gap: '8px', fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                                        {p.profession && <span>{p.profession}</span>}
                                        {p.location && <span>• {p.location}</span>}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default ProviderDirectoryPage;
