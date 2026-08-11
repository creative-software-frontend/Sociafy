import { useEffect, useState } from 'react';
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

const MIN_PASSWORD_LENGTH = 16;

export function AdminSetupPage() {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [loading, setLoading] = useState(true);
    const [setupCompleted, setSetupCompleted] = useState<boolean | null>(null);
    const [statusError, setStatusError] = useState('');

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPass, setShowPass] = useState(false);

    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Determine setup state so the form is only shown when setup is NOT completed.
    useEffect(() => {
        let active = true;
        (async () => {
            const res = await adminAuthApi.setupStatus();
            if (!active) return;
            setLoading(false);
            if (res.error) {
                setStatusError(res.error || 'Unable to check setup status.');
                return;
            }
            // Setup is driven by the live admin account count — no flag.
            setSetupCompleted(!res.data?.setup_available);
        })();
        return () => {
            active = false;
        };
    }, []);

    // Already signed in as admin → no need to set up.
    if (user && user.role === 'admin') {
        return <Navigate to="/admin/dashboard" replace />;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!name.trim() || !email || !password || !confirmPassword) {
            setError('Please fill in all fields.');
            return;
        }

        if (password.length < MIN_PASSWORD_LENGTH) {
            setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setSubmitting(true);
        try {
            const res = await adminAuthApi.setup({ name, email, password, confirmPassword });
            if (res.error || !res.data) {
                setError(res.error || 'Setup failed. Please try again.');
                return;
            }
            navigate('/admin/login', { replace: true });
        } finally {
            setSubmitting(false);
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

                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <h1 style={{
                        fontFamily: "'Cormorant Garamond', Georgia, serif",
                        fontSize: '2rem', letterSpacing: '0.2em',
                        color: 'var(--gold-mid)', fontWeight: 400, marginBottom: '6px',
                    }}>SOCIAFY</h1>
                    <span style={{
                        display: 'block', fontSize: '0.6rem', letterSpacing: '0.3em',
                        textTransform: 'uppercase', color: 'var(--text-muted)',
                        fontFamily: "'Inter', sans-serif", fontWeight: 600,
                    }}>First Admin Setup</span>
                </div>

                {loading && (
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontFamily: "'Inter', sans-serif", fontSize: '0.85rem' }}>
                        Checking setup status…
                    </p>
                )}

                {!loading && statusError && (
                    <div>
                        <div style={{
                            padding: '10px 14px', background: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px',
                            color: '#fca5a5', fontSize: '0.8rem', fontFamily: "'Inter', sans-serif",
                            marginBottom: '18px',
                        }}>{statusError}</div>
                        <p style={{ textAlign: 'center', fontFamily: "'Inter', sans-serif", fontSize: '0.8rem', color: '#ffffff' }}>
                            <Link to="/admin/login" style={{ color: 'var(--blue-vivid)', textDecoration: 'none', fontWeight: 500 }}>
                                Back to admin login
                            </Link>
                        </p>
                    </div>
                )}

                {!loading && !statusError && setupCompleted && (
                    <div>
                        <div style={{
                            padding: '14px', background: 'rgba(234,179,8,0.08)',
                            border: '1px solid rgba(234,179,8,0.3)', borderRadius: '8px',
                            color: '#fde68a', fontSize: '0.85rem', fontFamily: "'Inter', sans-serif",
                            lineHeight: 1.5, marginBottom: '20px',
                        }}>
                            An administrator account already exists. Please use the admin login portal.
                        </div>
                        <p style={{ textAlign: 'center', fontFamily: "'Inter', sans-serif", fontSize: '0.8rem', color: '#ffffff' }}>
                            <Link to="/admin/login" style={{ color: 'var(--blue-vivid)', textDecoration: 'none', fontWeight: 500 }}>
                                Go to admin login
                            </Link>
                        </p>
                    </div>
                )}

                {!loading && !statusError && setupCompleted === false && (
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <p style={{
                            textAlign: 'center', marginTop: '0', marginBottom: '0',
                            fontSize: '0.8rem', fontFamily: "'Inter', sans-serif", color: '#ffffff',
                            background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)',
                            borderRadius: '8px', padding: '10px 14px', lineHeight: 1.5,
                        }}>
                            This page is only for creating the first administrator account.
                        </p>

                        {error && (
                            <div style={{
                                padding: '10px 14px', background: 'rgba(239,68,68,0.1)',
                                border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px',
                                color: '#fca5a5', fontSize: '0.8rem', fontFamily: "'Inter', sans-serif",
                            }}>{error}</div>
                        )}

                        <div>
                            <label style={labelStyle}>Name</label>
                            <input
                                id="admin-setup-name"
                                type="text"
                                placeholder="Administrator name"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                style={inputStyle}
                            />
                        </div>

                        <div>
                            <label style={labelStyle}>Email</label>
                            <input
                                id="admin-setup-email"
                                type="email"
                                placeholder="admin@sociafy.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                style={inputStyle}
                            />
                        </div>

                        <div>
                            <label style={labelStyle}>Password</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    id="admin-setup-password"
                                    type={showPass ? 'text' : 'password'}
                                    placeholder="At least 16 characters"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    style={{ ...inputStyle, padding: '12px 44px 12px 16px' }}
                                />
                                <button type="button" onClick={() => setShowPass(v => !v)} style={{
                                    position: 'absolute', right: '14px', top: '50%',
                                    transform: 'translateY(-50%)', background: 'none',
                                    border: 'none', padding: 0, color: 'var(--text-muted)', cursor: 'pointer',
                                }}>{eyeIcon}</button>
                            </div>
                        </div>

                        <div>
                            <label style={labelStyle}>Confirm Password</label>
                            <input
                                id="admin-setup-confirm"
                                type={showPass ? 'text' : 'password'}
                                placeholder="Re-enter password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                style={inputStyle}
                            />
                        </div>

                        <button
                            id="admin-setup-submit"
                            type="submit"
                            disabled={submitting}
                            style={{
                                width: '100%', padding: '14px', marginTop: '4px',
                                background: submitting
                                    ? 'rgba(59,130,246,0.4)'
                                    : 'linear-gradient(135deg, var(--blue-neon), var(--blue-vivid))',
                                border: 'none', borderRadius: '8px', color: '#fff',
                                fontSize: '0.65rem', letterSpacing: '0.18em', textTransform: 'uppercase',
                                fontWeight: 700, fontFamily: "'Inter', sans-serif",
                                cursor: submitting ? 'not-allowed' : 'pointer',
                                boxShadow: submitting ? 'none' : 'var(--shadow-blue)',
                                transition: 'filter 0.2s, transform 0.2s',
                            }}
                        >
                            {submitting ? 'Creating…' : 'Create Admin Account'}
                        </button>

                        <p style={{
                            textAlign: 'center', marginTop: '8px', marginBottom: '0',
                            fontSize: '0.8rem', fontFamily: "'Inter', sans-serif", color: '#ffffff',
                        }}>
                            Already have an admin account?{' '}
                            <Link to="/admin/login" style={{ color: 'var(--blue-vivid)', textDecoration: 'none', fontWeight: 500 }}>
                                Sign in
                            </Link>
                        </p>
                    </form>
                )}
            </div>
        </div>
    );
}
