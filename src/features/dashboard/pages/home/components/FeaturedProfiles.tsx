import { resolveMediaUrl } from '../../../../../config/apiConfig';

export function FeaturedProfiles({
    profiles,
    loading,
    isUser,
    onSelect,
}: {
    profiles: Array<{
        id: number;
        name: string;
        avatar_url: string | null;
        profession: string | null;
        location: string | null;
        interests?: string | null;
        date_of_birth?: string | null;
        membership_package?: string | null;
    }>;
    loading?: boolean;
    isUser?: boolean;
    onSelect: (id: number) => void;
}) {
    const toFullUploadUrl = (url: string | null): string | undefined => {
        return resolveMediaUrl(url) || undefined;
    };

    const getAge = (dob: string | null | undefined) => {
        if (!dob) return null;
        const diff = Date.now() - new Date(dob).getTime();
        const age = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
        return age > 0 && age < 150 ? age : null;
    };

    return (
        <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{ color: 'var(--gold-mid)', fontSize: '18px', textShadow: '0 0 10px rgba(232,160,32,0.7)', flexShrink: 0 }}>★</span>
                <span style={{ fontSize: 'clamp(0.9rem, 4vw, 1rem)', fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter', sans-serif" }}>
                    {isUser ? 'Membership Holders' : 'Featured Profiles'}
                </span>
            </div>
            {/* Horizontal scroll — cards sized relative to viewport */}
            <div style={{ display: 'flex', gap: 'clamp(10px, 3vw, 14px)', overflowX: 'auto', paddingBottom: '10px', WebkitOverflowScrolling: 'touch' }}>
                {loading && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '20px 0' }}>
                        Loading profiles...
                    </p>
                )}

                {!loading && profiles.length === 0 && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '20px 0' }}>
                        No member profiles available yet.
                    </p>
                )}

                {!loading && profiles.map(p => {
                    const age = isUser ? getAge(p.date_of_birth) : null;
                    return (
                    <div
                        key={p.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`View profile of ${p.name}`}
                        onClick={() => onSelect(p.id)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onSelect(p.id);
                            }
                        }}
                        style={{
                            flex: '0 0 clamp(120px, 38vw, 150px)',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            border: isUser ? '2px solid var(--gold-mid)' : '2px solid var(--blue-vivid)',
                            position: 'relative',
                            cursor: 'pointer',
                            boxShadow: isUser ? '0 0 15px rgba(232,160,32,0.3)' : '0 0 15px rgba(59,130,246,0.3)',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                            outline: 'none',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-3px)';
                            e.currentTarget.style.boxShadow = isUser
                                ? '0 0 22px rgba(232,160,32,0.45)'
                                : '0 0 22px rgba(59,130,246,0.45)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = isUser
                                ? '0 0 15px rgba(232,160,32,0.3)'
                                : '0 0 15px rgba(59,130,246,0.3)';
                        }}
                        onFocus={(e) => {
                            e.currentTarget.style.boxShadow = isUser
                                ? '0 0 22px rgba(232,160,32,0.45)'
                                : '0 0 22px rgba(59,130,246,0.45)';
                        }}
                        onBlur={(e) => {
                            e.currentTarget.style.boxShadow = isUser
                                ? '0 0 15px rgba(232,160,32,0.3)'
                                : '0 0 15px rgba(59,130,246,0.3)';
                        }}
                    >
                        {p.avatar_url ? (
                            <img src={toFullUploadUrl(p.avatar_url)} alt={p.name} style={{ width: '100%', height: 'clamp(150px, 48vw, 190px)', objectFit: 'cover', display: 'block' }} />
                        ) : (
                            <div style={{
                                width: '100%',
                                height: 'clamp(150px, 48vw, 190px)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'linear-gradient(135deg, var(--bg-card-hover), var(--bg-card))',
                                color: 'var(--text-secondary)',
                                fontSize: '2rem',
                                fontWeight: 700,
                            }}>
                                {p.name ? p.name.substring(0, 2).toUpperCase() : '?'}
                            </div>
                        )}
                        {isUser && p.membership_package && (
                            <span style={{
                                position: 'absolute', top: '8px', right: '8px',
                                background: 'var(--gold-mid)', color: '#000',
                                fontSize: '0.5rem', letterSpacing: '0.1em',
                                textTransform: 'uppercase', padding: '3px 8px',
                                borderRadius: '4px', fontFamily: "'Inter', sans-serif", fontWeight: 800,
                            }}>
                                {p.membership_package}
                            </span>
                        )}
                        <div style={{
                            position: 'absolute', bottom: 0, left: 0, right: 0,
                            background: 'linear-gradient(transparent, var(--bg-nav))',
                            padding: '28px 10px 10px',
                        }}>
                            <p style={{ color: 'var(--text-primary)', fontSize: 'clamp(0.85rem, 4vw, 1rem)', fontWeight: 700, fontFamily: "'Inter', sans-serif", marginBottom: '3px' }}>
                                {p.name}{age ? `, ${age}` : ''}
                            </p>
                            <p style={{ color: isUser ? 'var(--gold-mid)' : 'var(--blue-vivid)', fontSize: 'clamp(0.6rem, 2.5vw, 0.7rem)', fontWeight: 600, fontFamily: "'Inter', sans-serif", textShadow: isUser ? '0 0 5px rgba(232,160,32,0.5)' : '0 0 5px rgba(96,165,250,0.5)' }}>
                                {isUser ? (p.location || p.profession || `#${p.id}`) : (p.profession || p.location || `#${p.id}`)}
                            </p>
                        </div>
                    </div>
                    );
                })}
            </div>
        </div>
    );
}

