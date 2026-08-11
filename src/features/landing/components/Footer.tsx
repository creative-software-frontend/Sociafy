export function Footer() {
    const year = new Date().getFullYear();

    return (
        <footer style={{
            position: 'relative',
            borderTop: '1px solid var(--border-default)',
            background: 'var(--bg-root)',
            overflow: 'hidden',
        }}>
            {/* Ambient glow */}
            <div style={{
                position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
                width: '700px', height: '200px', borderRadius: '50%',
                background: 'rgba(29, 78, 216, 0.05)', filter: 'blur(100px)',
                pointerEvents: 'none',
            }} />

            {/* Top gold accent */}
            <div style={{
                position: 'absolute', top: 0, left: '33%', right: '33%', height: '1px',
                background: 'linear-gradient(90deg, transparent, var(--gold-border), transparent)',
            }} />

            <div className="footer-inner">
                {/* Brand */}
                <div style={{ marginBottom: '40px' }}>
                    <span style={{
                        display: 'block',
                        fontFamily: "var(--font-serif)",
                        fontSize: 'clamp(1.2rem, 4vw, 1.5rem)',
                        letterSpacing: '0.3em',
                        color: 'var(--text-primary)',
                        fontWeight: 300,
                        marginBottom: '8px',
                    }}>
                        SOCIAFY
                    </span>
                    <span style={{
                        display: 'block',
                        fontSize: '0.55rem', letterSpacing: '0.25em', textTransform: 'uppercase',
                        color: 'var(--gold-mid)', fontFamily: "var(--font-sans)", fontWeight: 600,
                    }}>
                        The Ultimate Elite Network
                    </span>

                    {/* Ornament */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginTop: '20px' }}>
                        <div style={{ width: '48px', height: '1px', background: 'linear-gradient(to right, transparent, var(--gold-border))' }} />
                        <span style={{ color: 'var(--gold-border)', fontSize: '10px' }}>◆</span>
                        <div style={{ width: '48px', height: '1px', background: 'linear-gradient(to left, transparent, var(--gold-border))' }} />
                    </div>
                </div>

                {/* Nav links */}
                <nav style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    gap: 'clamp(16px, 4vw, 32px)',
                    marginBottom: '40px',
                }}>
                    {[
                        { label: 'Terms of Service', href: '#' },
                        { label: 'Privacy Protocol', href: '#' },
                        { label: 'Concierge Contact', href: '#' },
                    ].map(link => (
                        <a
                            key={link.label}
                            href={link.href}
                            style={{
                                fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase',
                                fontWeight: 600, fontFamily: "var(--font-sans)",
                                color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.2s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'var(--gold-mid)')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                        >
                            {link.label}
                        </a>
                    ))}
                </nav>

                {/* Copyright */}
                <p style={{
                    fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase',
                    color: 'var(--blue-dim)', fontFamily: "var(--font-sans)",
                }}>
                    © {year} Sociafy Network · All Rights Reserved
                </p>
            </div>
        </footer>
    );
}
