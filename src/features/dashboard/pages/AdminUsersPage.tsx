import { useEffect, useMemo, useState } from 'react';
import { TopNav } from './TopNav';
import { adminApi } from '../../../utils/api';
import { motion, AnimatePresence } from 'framer-motion';

interface UserInfo {
    id: number;
    name: string;
    email: string;
    phone: string;
    role: string;
    is_active: number;
    created_at: string;
}

interface Summary {
    totalUsers: number;
    totalProviders: number;
    users: UserInfo[];
    providers: UserInfo[];
}

const fadeUp = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const containerAnim = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.05 } },
};

export function AdminUsersPage() {
    const [summary, setSummary] = useState<Summary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<'users' | 'providers'>('users');
    const [searchQuery, setSearchQuery] = useState('');

    const filteredPeople = useMemo(() => {
        if (!summary) return [];
        const people = activeTab === 'users' ? summary.users : summary.providers;
        if (!searchQuery.trim()) return people;
        const q = searchQuery.toLowerCase().trim();
        return people.filter(
            p =>
                p.name.toLowerCase().includes(q) ||
                p.email.toLowerCase().includes(q) ||
                p.phone.includes(q)
        );
    }, [summary, activeTab, searchQuery]);

    const fetchSummary = async () => {
        setLoading(true);
        const res = await adminApi.getUsersSummary();
        if (res.error) {
            setError(res.error);
        } else {
            setSummary(res.data || null);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchSummary();
    }, []);

    const handleToggleActive = async (id: number, currentStatus: number) => {
        const action = currentStatus === 1 ? 'block' : 'unblock';
        if (!window.confirm(`Are you sure you want to ${action} this account?`)) return;

        try {
            const res = await adminApi.toggleUserActive(id);
            if (res.error) {
                alert(res.error);
            } else {
                // Refresh summary from the server to get precise updated counts and state
                await fetchSummary();
            }
        } catch (err: any) {
            alert(err.message || 'Failed to update account status');
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-main)',
            width: '100%',
        }}>
            <TopNav />

            <motion.div initial="hidden" animate="visible" variants={containerAnim} className="container" style={{
                paddingTop: '108px',
                paddingBottom: '80px',
            }}>

                {/* Page Title */}
                <motion.div variants={fadeUp} style={{ marginBottom: 'var(--space-6)' }}>
                    <h2 style={{
                        margin: 0,
                        fontSize: '1.5rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                    }}>
                        User Management
                    </h2>
                    <p style={{
                        margin: '4px 0 0',
                        fontSize: '0.85rem',
                        color: 'var(--text-muted)',
                    }}>
                        Overview of all registered users and providers
                    </p>
                </motion.div>

                {/* Loading */}
                {loading && (
                    <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 'var(--space-4)'
                    }}>
                        <div className="spinner" style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--border-subtle)', borderTop: '3px solid var(--blue-neon)', animation: 'spin 0.8s linear infinite' }} />
                        <p style={{ color: 'var(--text-muted)' }}>Loading Users...</p>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div style={{
                        padding: '16px',
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--red-status)',
                        fontSize: '0.85rem',
                        marginBottom: 'var(--space-5)'
                    }}>
                        {error}
                    </div>
                )}

                {summary && (
                    <>
                        {/* Stats Cards */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                            gap: 'var(--space-4)',
                            marginBottom: 'var(--space-6)'
                        }}>
                            {/* Total Users Card */}
                            <motion.div variants={fadeUp} className="card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                                <div style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>👤</div>
                                <div style={{
                                    fontSize: 'clamp(2rem, 5vw, 3rem)',
                                    fontWeight: 700,
                                    color: 'var(--blue-vivid)',
                                    fontFamily: 'var(--font-display)',
                                    marginBottom: 'var(--space-1)',
                                    lineHeight: 1
                                }}>
                                    {summary.totalUsers}
                                </div>
                                <div className="eyebrow" style={{ color: 'var(--text-muted)' }}>
                                    Total Users
                                </div>
                            </motion.div>

                            {/* Total Providers Card */}
                            <motion.div variants={fadeUp} className="card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                                <div style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>🏢</div>
                                <div style={{
                                    fontSize: 'clamp(2rem, 5vw, 3rem)',
                                    fontWeight: 700,
                                    color: 'var(--green-status)',
                                    fontFamily: 'var(--font-display)',
                                    marginBottom: 'var(--space-1)',
                                    lineHeight: 1
                                }}>
                                    {summary.totalProviders}
                                </div>
                                <div className="eyebrow" style={{ color: 'var(--text-muted)' }}>
                                    Total Providers
                                </div>
                            </motion.div>
                        </div>

                        {/* Search Bar */}
                        <motion.div variants={fadeUp} style={{ position: 'relative', marginBottom: 'var(--space-5)' }}>
                            <span style={{
                                position: 'absolute',
                                left: '16px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--text-muted)',
                                display: 'flex',
                                alignItems: 'center',
                                pointerEvents: 'none'
                            }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                </svg>
                            </span>
                            <input
                                type="text"
                                placeholder={`Search ${activeTab === 'users' ? 'users' : 'providers'} instantly...`}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    paddingLeft: '44px'
                                }}
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    style={{
                                        position: 'absolute',
                                        right: '16px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--text-muted)',
                                        cursor: 'pointer',
                                        fontSize: '0.9rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    ✕
                                </button>
                            )}
                        </motion.div>

                        {/* Tabs */}
                        <motion.div variants={fadeUp} style={{
                            display: 'flex',
                            background: 'var(--bg-input)',
                            borderRadius: 'var(--radius-md)',
                            padding: '4px',
                            border: '1px solid var(--border-subtle)',
                            marginBottom: 'var(--space-6)'
                        }}>
                            <button
                                onClick={() => setActiveTab('users')}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    border: 'none',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '0.75rem',
                                    letterSpacing: '0.15em',
                                    textTransform: 'uppercase',
                                    fontWeight: 700,
                                    fontFamily: 'var(--font-display)',
                                    cursor: 'pointer',
                                    background: activeTab === 'users' ? 'var(--blue-dim)' : 'transparent',
                                    color: activeTab === 'users' ? '#fff' : 'var(--text-muted)',
                                    transition: 'all var(--duration-fast)',
                                    borderBottom: activeTab === 'users' ? '2px solid var(--blue-vivid)' : '2px solid transparent'
                                }}
                            >
                                👤 Users ({summary.totalUsers})
                            </button>
                            <button
                                onClick={() => setActiveTab('providers')}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    border: 'none',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '0.75rem',
                                    letterSpacing: '0.15em',
                                    textTransform: 'uppercase',
                                    fontWeight: 700,
                                    fontFamily: 'var(--font-display)',
                                    cursor: 'pointer',
                                    background: activeTab === 'providers' ? 'rgba(16,185,129,0.1)' : 'transparent',
                                    color: activeTab === 'providers' ? 'var(--green-status)' : 'var(--text-muted)',
                                    transition: 'all var(--duration-fast)',
                                    borderBottom: activeTab === 'providers' ? '2px solid var(--green-status)' : '2px solid transparent'
                                }}
                            >
                                🏢 Providers ({summary.totalProviders})
                            </button>
                        </motion.div>

                        {/* List */}
                        <motion.div layout className="admin-users-list" style={{ display: 'grid', gap: 'var(--space-3)' }}>
                            <AnimatePresence>
                                {filteredPeople.length === 0 ? (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        style={{
                                            textAlign: 'center',
                                            padding: '40px',
                                            color: 'var(--text-muted)',
                                            fontSize: '0.9rem'
                                        }}
                                    >
                                        No {activeTab} found
                                    </motion.div>
                                ) : (
                                    filteredPeople.map((person) => (
                                        <motion.div
                                            key={person.id}
                                            layout
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            transition={{ duration: 0.2 }}
                                            className="card admin-users-row"
                                            style={{
                                                padding: 'var(--space-4)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 'var(--space-4)',
                                                width: '100%',
                                                minWidth: 0,
                                            }}
                                        >
                                            {/* Avatar */}
                                            <div style={{
                                                width: '48px',
                                                height: '48px',
                                                borderRadius: '50%',
                                                background: activeTab === 'users'
                                                    ? 'linear-gradient(135deg, var(--blue-neon), var(--blue-vivid))'
                                                    : 'linear-gradient(135deg, var(--green-status), #059669)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: '#fff',
                                                fontWeight: 700,
                                                fontSize: '1.2rem',
                                                flexShrink: 0,
                                                boxShadow: activeTab === 'users' ? 'var(--shadow-blue)' : '0 0 15px rgba(16,185,129,0.3)'
                                            }}>
                                                {person.name.charAt(0).toUpperCase()}
                                            </div>

                                            {/* Info */}
                                            <div className="admin-users-info" style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{
                                                    fontWeight: 600,
                                                    fontSize: '1rem',
                                                    color: 'var(--text-primary)',
                                                    margin: '0 0 2px 0',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {person.name}
                                                </p>
                                                <p style={{
                                                    fontSize: '0.8rem',
                                                    color: 'var(--text-secondary)',
                                                    margin: '0 0 4px 0',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {person.email}
                                                </p>
                                                <p style={{
                                                    fontSize: '0.75rem',
                                                    color: 'var(--text-muted)',
                                                    margin: 0
                                                }}>
                                                    📱 {person.phone} · Joined {new Date(person.created_at).toLocaleDateString()}
                                                </p>
                                            </div>

                                            <div className="admin-users-actions">
                                                {/* Status Badge */}
                                                <div className="badge" style={{
                                                    background: person.is_active
                                                        ? 'rgba(16,185,129,0.1)'
                                                        : 'rgba(239,68,68,0.1)',
                                                    color: person.is_active
                                                        ? 'var(--green-status)'
                                                        : 'var(--red-status)',
                                                    borderColor: person.is_active
                                                        ? 'rgba(16,185,129,0.3)'
                                                        : 'rgba(239,68,68,0.3)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px'
                                                }}>
                                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
                                                    {person.is_active ? 'Active' : 'Blocked'}
                                                </div>

                                                {/* Block / Unblock Action Button */}
                                                <button
                                                    className="btn btn-sm"
                                                    onClick={() => handleToggleActive(person.id, person.is_active)}
                                                    style={{
                                                        flexShrink: 0,
                                                        background: person.is_active ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                                                        color: person.is_active ? 'var(--red-status)' : 'var(--green-status)',
                                                        border: `1px solid ${person.is_active ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.background = person.is_active ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.background = person.is_active ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)';
                                                    }}
                                                >
                                                    {person.is_active ? 'Block' : 'Unblock'}
                                                </button>
                                            </div>
                                        </motion.div>
                                    ))
                                )}
                            </AnimatePresence>
                        </motion.div>
                    </>
                )}
            </motion.div>
            
            <style>{`
              @keyframes spin { to { transform: rotate(360deg); } }

                            .admin-users-list {
                                min-width: 0;
                            }

                            .admin-users-row {
                                min-width: 0;
                            }

                            .admin-users-actions {
                                margin-left: auto;
                                display: inline-flex;
                                align-items: center;
                                gap: var(--space-3);
                                flex-shrink: 0;
                            }

                            @media (max-width: 1080px) {
                                .admin-users-row {
                                    flex-wrap: wrap;
                                    align-items: flex-start;
                                    row-gap: var(--space-3);
                                }

                                .admin-users-info {
                                    min-width: min(280px, 100%);
                                }

                                .admin-users-actions {
                                    width: 100%;
                                    margin-left: 0;
                                    padding-left: calc(48px + var(--space-4));
                                    justify-content: flex-start;
                                    flex-wrap: wrap;
                                }
                            }

                            @media (max-width: 720px) {
                                .admin-users-actions {
                                    padding-left: 0;
                                }
                            }
            `}</style>
        </div>
    );
}