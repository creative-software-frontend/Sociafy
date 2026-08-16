import { NavLink, useParams } from 'react-router-dom';

const walletIcon = (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 7h18v10H3z" />
        <path d="M16 11h.01" />
    </svg>
);

const giftIcon = (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01z" />
    </svg>
);

const settingsIcon = (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
);

const ITEMS = [
    { to: '/admin-wallet', label: 'WALLET', icon: walletIcon },
    { to: '/admin-gifts', label: 'GIFTS', icon: giftIcon },
    { to: '/platform-settings', label: 'RATES', icon: settingsIcon },
    { to: '/settings', label: 'SETTINGS', icon: settingsIcon },
];

/**
 * Admin overflow menu (bottom sheet) holding destinations that were removed
 * from the permanent bottom navigation. Uses the existing routes and matches
 * the dashboard mobile shell. Closes on navigation and on outside click.
 */
export function AdminMoreMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { role } = useParams<{ role: string }>();
    const basePath = `/${role}/dashboard`;

    if (!open) return null;

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 400,
                background: 'var(--bg-overlay)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: '100%',
                    maxWidth: '480px',
                    background: 'var(--bg-card)',
                    borderTopLeftRadius: '20px',
                    borderTopRightRadius: '20px',
                    borderTop: '1px solid var(--border-subtle)',
                    boxShadow: '0 -8px 30px rgba(0,0,0,0.4)',
                    padding: '16px 16px calc(16px + env(safe-area-inset-bottom, 0px))',
                    boxSizing: 'border-box',
                }}
            >
                <div style={{
                    width: 40,
                    height: 4,
                    borderRadius: 2,
                    background: 'var(--border-subtle)',
                    margin: '0 auto 16px',
                }} />

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {ITEMS.map((item) => (
                        <NavLink
                            key={item.to}
                            to={`${basePath}${item.to}`}
                            onClick={onClose}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                padding: '12px 8px',
                                borderRadius: 12,
                                textDecoration: 'none',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                letterSpacing: '0.05em',
                                textTransform: 'uppercase',
                            }}
                        >
                            {({ isActive }) => (
                                <>
                                    <span style={{
                                        color: isActive ? 'var(--gold-mid)' : 'var(--text-secondary)',
                                        display: 'flex',
                                        flexShrink: 0,
                                    }}>
                                        {item.icon}
                                    </span>
                                    <span style={{
                                        color: isActive ? 'var(--gold-mid)' : 'var(--text-primary)',
                                        background: isActive ? 'var(--bg-input)' : 'transparent',
                                        borderRadius: 8,
                                        padding: '4px 10px',
                                    }}>
                                        {item.label}
                                    </span>
                                </>
                            )}
                        </NavLink>
                    ))}
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    style={{
                        width: '100%',
                        marginTop: 12,
                        padding: '12px',
                        borderRadius: 12,
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-input)',
                        color: 'var(--text-secondary)',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                    }}
                >
                    Close
                </button>
            </div>
        </div>
    );
}

export default AdminMoreMenu;