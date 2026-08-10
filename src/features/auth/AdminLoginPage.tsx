import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { adminAuthApi } from '../../utils/api';

const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.6rem', letterSpacing: '0.18em',
    textTransform: 'uppercase', color: 'var(--text-muted)',
    fontFamily: "'Inter', sans-serif", fontWeight: 600, marginBottom: '8px',
};

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 16px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border-default)',
    borderRadius: '8px', color: 'var(--text-primary)',
    fontSize: '0.875rem', fontFamily: "'Inter', sans-serif",
    outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box',
};

export function AdminLoginPage() {
    const navigate = useNavigate();
    const { user, login } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Already signed in as admin → go straight to the dashboard.
    if (user && user.role === 'admin') {
        return <Navigate to="/admin/dashboard" replace />;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!email || !password) {
            setError('Please enter your email and password.');
            return;
        }

        setLoading(true);
        try {
            const res = await adminAuthApi.login({ email, password });

            if (res.error || !res.data) {
                setError(res.error || 'Admin login failed. Please try again.');
                return;
            }

            const { id, name, email: adminEmail, role, token } = res.data;
            login({ id, email: adminEmail, role, username: name, token });
            navigate('/admin/dashboard', { replace: true });
        } finally {
            setLoading(false);
        }
    };

    const eyeIcon = (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    );

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'var(--bg-main)', padding: '24px', position: 'relative', overflow: 'hidden',
        }}>
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                <div style={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '800px', height: '500px', borderRadius: '50%',
                    background: 'radial-gradient(ellipse, var(--blue-glow) 0%, transparent 70%)',
                }} />
                <div style={{
                    position: 'absolute', inset: 0, opacity: 0.12,
                    backgroundImage: 'radial-gradient(circle, var(--blue-glow) 1px, transparent 1px)',
                    backgroundSize: '36px 36px',
                }} />
            </div>

            <div style={{
                position: 'relative', width: '100%', maxWidth: '440px',
                background: 'var(--bg-card)', border: '1px solid var(--border-default)',
                borderRadius: '20px', padding: '40px 36px', boxShadow: 'var(--shadow-lg)',
            }}>
                <div style={{
                    position: 'absolute', top: 0, left: '20%', right: '20%', height: '1px',
                    background: 'linear-gradient(90deg, transparent, var(--gold-mid), transparent)',
                }} />

                <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                    <h1 style={{
                        fontFamily: "'Cormorant Garamond', Georgia, serif",
                        fontSize: '2rem', letterSpacing: '0.2em',
                        color: 'var(--gold-mid)', fontWeight: 400, marginBottom: '6px',
                    }}>BLUEDISE</h1>
                    <span style={{
                        display: 'block', fontSize: '0.6rem', letterSpacing: '0.3em',
                        textTransform: 'uppercase', color: 'var(--text-muted)',
                        fontFamily: "'Inter', sans-serif", fontWeight: 600,
                    }}>Admin Portal</span>
                </div>

                {error && (
                    <div style={{
                        padding: '10px 14px', background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px',
                        color: '#fca5a5', fontSize: '0.8rem', fontFamily: "'Inter', sans-serif",
                        marginBottom: '18px',
                    }}>{error}</div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    <div>
                        <label style={labelStyle}>Email Address</label>
                        <input
                            id="admin-auth-email"
                            type="email"
                            placeholder="admin@bluedise.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            style={inputStyle}
                            onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold-mid)')}
                            onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}
                        />
                    </div>

                    <div>
                        <label style={labelStyle}>Password</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                id="admin-auth-password"
                                type={showPass ? 'text' : 'password'}
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                style={{ ...inputStyle, padding: '12px 44px 12px 16px' }}
                                onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold-mid)')}
                                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}
                            />
                            <button type="button" onClick={() => setShowPass(v => !v)} style={{
                                position: 'absolute', right: '14px', top: '50%',
                                transform: 'translateY(-50%)', background: 'none',
                                border: 'none', padding: 0, color: 'var(--text-muted)', cursor: 'pointer',
                            }}>{eyeIcon}</button>
                        </div>
                    </div>

                    <button
                        id="admin-auth-submit"
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%', padding: '14px', marginTop: '4px',
                            background: loading
                                ? 'rgba(59,130,246,0.4)'
                                : 'linear-gradient(135deg, var(--blue-neon), var(--blue-vivid))',
                            border: 'none', borderRadius: '8px', color: '#fff',
                            fontSize: '0.65rem', letterSpacing: '0.18em', textTransform: 'uppercase',
                            fontWeight: 700, fontFamily: "'Inter', sans-serif",
                            cursor: loading ? 'not-allowed' : 'pointer',
                            boxShadow: loading ? 'none' : 'var(--shadow-blue)',
                            transition: 'filter 0.2s, transform 0.2s',
                        }}
                        onMouseEnter={e => {
                            if (!e.currentTarget.disabled) {
                                e.currentTarget.style.filter = 'brightness(1.15)';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                            }
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.filter = 'brightness(1)';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        {loading ? 'Please wait…' : 'Secure Admin Sign In'}
                    </button>
                </form>

                <p style={{
                    textAlign: 'center', marginTop: '24px',
                    fontSize: '0.8rem', fontFamily: "'Inter', sans-serif", color: '#ffffff',
                }}>
                    Not an administrator?{' '}
                    <Link to="/login" style={{ color: 'var(--blue-vivid)', textDecoration: 'none', fontWeight: 500 }}>
                        Member sign in
                    </Link>
                </p>

                <p style={{
                    textAlign: 'center', marginTop: '12px',
                    fontSize: '0.8rem', fontFamily: "'Inter', sans-serif", color: '#ffffff',
                }}>
                    First-time setup?{' '}
                    <Link to="/admin/setup" style={{ color: 'var(--gold-mid)', textDecoration: 'none', fontWeight: 500 }}>
                        Create First Admin Account
                    </Link>
                </p>

                <p style={{
                    textAlign: 'center', marginTop: '20px',
                    fontSize: '0.55rem', letterSpacing: '0.18em', textTransform: 'uppercase',
                    color: '#ffffff', fontFamily: "'Inter', sans-serif",
                }}>© 2026 BLUEDISE SECURED PORTAL</p>
            </div>
        </div>
    );
}
