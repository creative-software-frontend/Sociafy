import { Link } from "react-router-dom";

export function TopNav() {
    return (
        <>
            <div style={{ height: '64px', width: '100%', flexShrink: 0 }} />
            <nav style={{
                position: 'fixed',
                top: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 200,
                width: '100%',
                maxWidth: '480px',
                backgroundColor: 'var(--bg-overlay)',
                backdropFilter: 'blur(20px)',
                borderBottom: '1px solid var(--border-subtle)',
            }}>
                <div className="navbar-inner" style={{ justifyContent: 'center' }}>
                    {/* Brand */}
                    <Link to="/" className="navbar-brand" style={{ textDecoration: 'none' }}>
                        SOCIAFY
                    </Link>
                </div>
            </nav>
        </>
    );
}