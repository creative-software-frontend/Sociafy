import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../utils/api';
import type { Role } from '../../context/AuthContext';
import {
    BD_COUNTRY_CODE,
    BD_PHONE_ERROR,
    isValidBdMobile,
    sanitizeBdMobileInput,
} from './utils/phoneValidation';

// ─── Styles ──────────────────────────────────────────────────────────────────
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

    // ─── Checkmark Icon ───────────────────────────────────────────────────────
    const checkIcon = (
        <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
            <path d="M1 4L4 7.5L10 1" stroke="white" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );

export function ProviderRegisterPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const { login } = useAuth();
    const isLogin = location.pathname === '/login';

    const [showPass, setShowPass] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [username, setUsername] = useState('');
    const [phone, setPhone] = useState('');
    const [privacyAccepted, setPrivacyAccepted] = useState(false);
    const [termsAccepted, setTermsAccepted] = useState(false);

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const normalizedPhone = phone.replace(/\s+/g, '');
    const signupBlocked = !isLogin && (
        !isValidBdMobile(normalizedPhone) ||
        !privacyAccepted ||
        !termsAccepted
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!email || !password) {
            setError('Please fill in all required fields.');
            return;
        }

        setLoading(true);

        try {
            if (isLogin) {
                const res = await authApi.login({ email, password });

                if (res.error || !res.data) {
                    setError(res.error || 'Login failed. Please try again.');
                    return;
                }

                const { id, name, email: userEmail, role: userRole, token } = res.data;
                login({ id, email: userEmail, role: userRole as Role, username: name, token });
                navigate(`/${userRole}/dashboard`);
                return;

            } else {

                if (!username.trim()) {
                    setError('Please enter a username.');
                    return;
                }
                if (password.length < 6) {
                    setError('Password must be at least 6 characters.');
                    return;
                }
                if (password !== confirmPassword) {
                    setError('Passwords do not match.');
                    return;
                }

                const normalizedPhone = phone.replace(/\s+/g, '');
                if (!normalizedPhone) {
                    setError('Please enter your phone number.');
                    return;
                }
                if (!isValidBdMobile(normalizedPhone)) {
                    setError(BD_PHONE_ERROR);
                    return;
                }

                if (!privacyAccepted) {
                    setError('You must accept the Privacy Policy to continue.');
                    return;
                }

                if (!termsAccepted) {
                    setError('You must accept the Terms & Conditions to continue.');
                    return;
                }

                const finalPhone = `${BD_COUNTRY_CODE}${normalizedPhone}`;

                const res = await authApi.register({
                    name: username.trim(),
                    email,
                    phone: finalPhone,
                    password,
                    role: 'provider',
                    privacyAccepted: privacyAccepted,
                });

                if (res.error || !res.data) {
                    setError(res.error || 'Registration failed. Please try again.');
                    return;
                }

                navigate('/login');
            }
        } finally {
            setLoading(false);
        }
    };

    // ─── Eye Icon ─────────────────────────────────────────────────────────────
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
            {/* ── Background Glows ── */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                <div style={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '800px', height: '500px', borderRadius: '50%',
                    background: 'radial-gradient(ellipse, var(--blue-glow) 0%, transparent 70%)',
                }} />
                <div style={{
                    position: 'absolute', top: '20%', left: '30%',
                    width: '400px', height: '300px', borderRadius: '50%',
                    background: 'var(--blue-glow)', filter: 'blur(80px)',
                }} />
                <div style={{
                    position: 'absolute', inset: 0, opacity: 0.12,
                    backgroundImage: 'radial-gradient(circle, var(--blue-glow) 1px, transparent 1px)',
                    backgroundSize: '36px 36px',
                }} />
            </div>

            {/* ── Card ── */}
            <div style={{
                position: 'relative', width: '100%', maxWidth: '440px',
                background: 'var(--bg-card)', border: '1px solid var(--border-default)',
                borderRadius: '20px', padding: '40px 36px', boxShadow: 'var(--shadow-lg)',
            }}>
                <div style={{
                    position: 'absolute', top: 0, left: '20%', right: '20%', height: '1px',
                    background: 'linear-gradient(90deg, transparent, var(--blue-vivid), transparent)',
                }} />

                {/* ── Logo ── */}
                <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                    <h1 style={{
                        fontFamily: "'Cormorant Garamond', Georgia, serif",
                        fontSize: '2rem', letterSpacing: '0.2em',
                        color: 'var(--gold-mid)', fontWeight: 400, marginBottom: '6px',
                    }}>SOCIAFY</h1>
                    <span style={{
                        display: 'block', fontSize: '0.6rem', letterSpacing: '0.3em',
                        textTransform: 'uppercase', color: 'var(--text-muted)',
                        fontFamily: "'Inter', sans-serif", fontWeight: 600,
                    }}>Member Portal</span>
                </div>

                {/* ── Tabs ── */}
                <div style={{
                    display: 'flex', background: 'var(--bg-nav)',
                    borderRadius: '8px', padding: '4px',
                    border: '1px solid var(--border-subtle)', marginBottom: '28px',
                }}>
                    <Link to="/signup" style={{
                        flex: 1, textAlign: 'center', padding: '9px 0',
                        fontSize: '0.65rem', letterSpacing: '0.18em', textTransform: 'uppercase',
                        fontWeight: 600, fontFamily: "'Inter', sans-serif",
                        textDecoration: 'none', borderRadius: '5px', transition: 'all 0.2s',
                        color: !isLogin ? 'var(--text-primary)' : 'var(--text-muted)',
                        background: !isLogin ? 'var(--blue-glow)' : 'transparent',
                    }}>Register</Link>
                    <Link to="/login" style={{
                        flex: 1, textAlign: 'center', padding: '9px 0',
                        fontSize: '0.65rem', letterSpacing: '0.18em', textTransform: 'uppercase',
                        fontWeight: 600, fontFamily: "'Inter', sans-serif",
                        textDecoration: 'none', borderRadius: '5px', transition: 'all 0.2s',
                        color: isLogin ? 'var(--text-primary)' : 'var(--text-muted)',
                        background: isLogin ? 'var(--blue-glow)' : 'transparent',
                    }}>Sign In</Link>
                </div>

                {/* ── Error ── */}
                {error && (
                    <div style={{
                        padding: '10px 14px', background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px',
                        color: '#fca5a5', fontSize: '0.8rem', fontFamily: "'Inter', sans-serif",
                        marginBottom: '18px',
                    }}>{error}</div>
                )}

                {/* ── Form ── */}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

                    {/* Username */}
                    {!isLogin && (
                        <div>
                            <label style={labelStyle}>Username</label>
                            <input
                                id="auth-username"
                                type="text"
                                placeholder="Choose a username"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                style={inputStyle}
                                onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold-mid)')}
                                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}
                            />
                        </div>
                    )}

                    {/* Email */}
                    <div>
                        <label style={labelStyle}>Email Address</label>
                        <input
                            id="auth-email"
                            type="email"
                            placeholder="your@email.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            style={inputStyle}
                            onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold-mid)')}
                            onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}
                        />
                    </div>

                    {/* Phone */}
                    {!isLogin && (
                        <div>
                            <label style={labelStyle}>Phone Number</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <span
                                    id="auth-country-code"
                                    style={{
                                        ...inputStyle, width: 'auto', flexShrink: 0,
                                        paddingRight: '12px', cursor: 'default',
                                        display: 'inline-flex', alignItems: 'center',
                                        color: 'var(--text-muted)',
                                    }}
                                >{BD_COUNTRY_CODE}</span>
                                <input
                                    id="auth-phone"
                                    type="tel"
                                    inputMode="tel"
                                    placeholder="1XXXXXXXXX"
                                    value={phone}
                                    onChange={e => setPhone(sanitizeBdMobileInput(e.target.value))}
                                    maxLength={10}
                                    style={{ ...inputStyle, flex: 1 }}
                                    onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold-mid)')}
                                    onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}
                                />
                            </div>
                        </div>
                    )}

                    {/* Password */}
                    <div>
                        <label style={labelStyle}>Password</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                id="auth-password"
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

                    {/* Confirm Password */}
                    {!isLogin && (
                        <div>
                            <label style={labelStyle}>Confirm Password</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    id="auth-confirm-password"
                                    type={showConfirm ? 'text' : 'password'}
                                    placeholder="Repeat password"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    style={{ ...inputStyle, padding: '12px 44px 12px 16px' }}
                                    onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold-mid)')}
                                    onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}
                                />
                                <button type="button" onClick={() => setShowConfirm(v => !v)} style={{
                                    position: 'absolute', right: '14px', top: '50%',
                                    transform: 'translateY(-50%)', background: 'none',
                                    border: 'none', padding: 0, color: 'var(--text-muted)', cursor: 'pointer',
                                }}>{eyeIcon}</button>
                            </div>
                        </div>
                    )}

                    {/* ✅ Privacy Policy & Terms Combined Checkbox */}
                    {!isLogin && (
                        <div
                            onClick={() => {
                                setPrivacyAccepted(v => !v);
                                setTermsAccepted(v => !v);
                            }}
                            style={{
                                display: 'flex', alignItems: 'flex-start',
                                gap: '10px', cursor: 'pointer', marginBottom: '4px',
                            }}
                        >
                            <div style={{
                                marginTop: '2px',
                                width: '18px', height: '18px', minWidth: '18px',
                                borderRadius: '4px',
                                border: `2px solid ${privacyAccepted && termsAccepted ? '#22c55e' : '#555'}`,
                                backgroundColor: privacyAccepted && termsAccepted ? '#22c55e' : 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.2s',
                            }}>
                                {privacyAccepted && termsAccepted && checkIcon}
                            </div>
                            <span style={{
                                fontSize: '0.75rem', color: 'var(--text-secondary)',
                                lineHeight: '1.5', userSelect: 'none',
                            }}>
                                I accept the{' '}
                                <a
                                    href="/privacy-policy"
                                    onClick={e => e.stopPropagation()}
                                    style={{ color: 'var(--blue-vivid)', textDecoration: 'underline' }}
                                    target="_blank" rel="noreferrer"
                                >
                                    Privacy Policy
                                </a>
                                {' '}and{' '}
                                <a
                                    href="/terms-and-conditions"
                                    onClick={e => e.stopPropagation()}
                                    style={{ color: 'var(--blue-vivid)', textDecoration: 'underline' }}
                                    target="_blank" rel="noreferrer"
                                >
                                    Terms &amp; Conditions
                                </a>
                            </span>
                        </div>
                    )}

                    {/* ── Submit Button ── */}
                    <button
                        id="auth-submit"
                        type="submit"
                        disabled={loading || signupBlocked}
                        style={{
                            width: '100%', padding: '14px', marginTop: '4px',
                            background: (loading || signupBlocked)
                                ? 'rgba(59,130,246,0.4)'
                                : 'linear-gradient(135deg, var(--blue-neon), var(--blue-vivid))',
                            border: 'none', borderRadius: '8px', color: '#fff',
                            fontSize: '0.65rem', letterSpacing: '0.18em', textTransform: 'uppercase',
                            fontWeight: 700, fontFamily: "'Inter', sans-serif",
                            cursor: (loading || signupBlocked)
                                ? 'not-allowed'
                                : 'pointer',
                            boxShadow: (loading || signupBlocked)
                                ? 'none'
                                : 'var(--shadow-blue)',
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
                        {loading ? 'Please wait…' : isLogin ? 'Secure Sign In' : 'Create Account'}
                    </button>
                </form>

                {/* ── Footer Links ── */}
                <p style={{
                    textAlign: 'center', marginTop: '24px',
                    fontSize: '0.8rem', fontFamily: "'Inter', sans-serif", color: '#ffffff',
                }}>
                    {isLogin ? (
                        <>New to Sociafy?{' '}
                            <Link to="/signup" style={{ color: 'var(--blue-vivid)', textDecoration: 'none', fontWeight: 500 }}>
                                Create an account
                            </Link>
                        </>
                    ) : (
                        <>Already a member?{' '}
                            <Link to="/login" style={{ color: 'var(--blue-vivid)', textDecoration: 'none', fontWeight: 500 }}>
                                Sign in here
                            </Link>
                        </>
                    )}
                </p>

                {/* ── Provider Register Hint ── */}
                {isLogin && (
                    <p style={{
                        textAlign: 'center', marginTop: '12px',
                        fontSize: '0.72rem', fontFamily: "'Inter', sans-serif", color: '#ffffff',
                    }}>
                        Are you a service provider?{' '}
                        <Link to="/provider/register" style={{ color: 'var(--blue-vivid)', textDecoration: 'none', fontWeight: 500 }}>
                            Register here
                        </Link>
                    </p>
                )}

                <p style={{
                    textAlign: 'center', marginTop: '20px',
                    fontSize: '0.55rem', letterSpacing: '0.18em', textTransform: 'uppercase',
                    color: '#ffffff', fontFamily: "'Inter', sans-serif",
                }}>© 2026 SOCIAFY SECURED PORTAL</p>
            </div>
        </div>
    );
}