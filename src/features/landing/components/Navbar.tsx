import { useState } from "react";
import { Link } from "react-router-dom";

export function Navbar() {
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <nav style={{
            position: 'sticky',
            top: 0,
            zIndex: 200,
            width: '100%',
            backgroundColor: 'var(--bg-overlay)',
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid var(--border-subtle)',
        }}>
            <div className="navbar-inner">
                {/* Brand */}
                <span className="navbar-brand">SOCIAFY</span>

                {/* Desktop Nav Links */}
                <div className="navbar-links">
                    <a href="#experiences" style={{
                        color: 'var(--text-secondary)',
                        fontSize: '0.65rem',
                        letterSpacing: '0.2em',
                        textTransform: 'uppercase',
                        fontWeight: 500,
                        textDecoration: 'none',
                        transition: 'color 0.2s',
                        fontFamily: "'Inter', sans-serif",
                    }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--gold-light)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                    >
                        Experiences
                    </a>
                    <a href="#tiers" style={{
                        color: 'var(--text-secondary)',
                        fontSize: '0.65rem',
                        letterSpacing: '0.2em',
                        textTransform: 'uppercase',
                        fontWeight: 500,
                        textDecoration: 'none',
                        transition: 'color 0.2s',
                        fontFamily: "'Inter', sans-serif",
                    }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--gold-light)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                    >
                        Tiers
                    </a>
                    <Link to="/login" style={{
                        color: 'var(--text-secondary)',
                        fontSize: '0.65rem',
                        letterSpacing: '0.2em',
                        textTransform: 'uppercase',
                        fontWeight: 500,
                        textDecoration: 'none',
                        transition: 'color 0.2s',
                        fontFamily: "'Inter', sans-serif",
                    }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--gold-light)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                    >
                        Sign In
                    </Link>
                    <a href="#tiers" style={{
                        backgroundColor: 'var(--gold-mid)',
                        color: '#000',
                        padding: '10px 22px',
                        fontSize: '0.6rem',
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        fontWeight: 700,
                        textDecoration: 'none',
                        fontFamily: "'Inter', sans-serif",
                        borderRadius: '2px',
                        transition: 'filter 0.2s',
                        whiteSpace: 'nowrap',
                    }}
                        onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.12)')}
                        onMouseLeave={e => (e.currentTarget.style.filter = 'brightness(1)')}
                    >
                        Apply Now
                    </a>
                </div>

                {/* Hamburger button (mobile/tablet) */}
                <button
                    className={`navbar-hamburger${menuOpen ? ' open' : ''}`}
                    aria-label="Toggle navigation"
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen(prev => !prev)}
                >
                    <span />
                    <span />
                    <span />
                </button>

                {/* Mobile dropdown menu */}
                <div className={`navbar-mobile-menu${menuOpen ? ' open' : ''}`}>
                    <a href="#experiences" className="navbar-mobile-link" onClick={() => setMenuOpen(false)}>
                        Experiences
                    </a>
                    <a href="#tiers" className="navbar-mobile-link" onClick={() => setMenuOpen(false)}>
                        Tiers
                    </a>
                    <Link to="/login" className="navbar-mobile-link" onClick={() => setMenuOpen(false)}>
                        Sign In
                    </Link>
                    <a href="#tiers" className="navbar-mobile-cta" onClick={() => setMenuOpen(false)}>
                        Apply Now
                    </a>
                </div>
            </div>
        </nav>
    );
}