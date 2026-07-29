import { NavLink, Outlet } from 'react-router-dom';
import { useParams } from 'react-router-dom';

const ICONS = {
    home: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
        </svg>
    ),
    membership: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01z" />
        </svg>
    ),
    assets: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8" /><path d="M12 17v4" />
        </svg>
    ),
    network: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="5" r="3" /><circle cx="5" cy="19" r="3" /><circle cx="19" cy="19" r="3" />
            <line x1="12" y1="8" x2="5" y2="16" /><line x1="12" y1="8" x2="19" y2="16" />
        </svg>
    ),
    profile: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
        </svg>
    ),
    users: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    ),
    reports: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
        </svg>
    ),
    settings: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
    ),
    services: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
    ),
    newsfeed: (
        <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="7" y1="8" x2="17" y2="8" />
            <line x1="7" y1="12" x2="17" y2="12" />
            <line x1="7" y1="16" x2="13" y2="16" />
        </svg>
    ),

    wallet: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 7h18v10H3z" />
            <path d="M16 11h.01" />
        </svg>
    ),

    social: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
    ),
    chat: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            <line x1="8" y1="10" x2="16" y2="10" />
            <line x1="8" y1="14" x2="12" y2="14" />
        </svg>
    ),
    callhistory: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
    ),
    earnings: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
    ),
};


// ... existing code ...

const USER_NAV = [
    { to: '', end: true, label: 'HOME', icon: ICONS.home },
    { to: '/services', end: false, label: 'SERVICES', icon: ICONS.services },
    { to: '/membership', end: false, label: 'MEMBERSHIP', icon: ICONS.membership },
    { to: '/wallet', end: false, label: 'WALLET', icon: ICONS.wallet },
    { to: '/chat', end: false, label: 'CHAT', icon: ICONS.chat },
    { to: '/newsfeed', end: false, label: 'NEWSFEED', icon: ICONS.newsfeed },
    { to: '/profile', end: false, label: 'PROFILE', icon: ICONS.profile },
];

const ADMIN_NAV = [
    { to: '', end: true, label: 'HOME', icon: ICONS.home },
    { to: '/users', end: false, label: 'USERS', icon: ICONS.users },
    { to: '/reports', end: false, label: 'REPORTS', icon: ICONS.reports },
    { to: '/settings', end: false, label: 'SETTINGS', icon: ICONS.settings },
    { to: '/profile', end: false, label: 'PROFILE', icon: ICONS.profile },

];

const PROVIDER_NAV = [
    { to: '', end: true, label: 'HOME', icon: ICONS.home },
    { to: '/services', end: false, label: 'SERVICES', icon: ICONS.social },
    { to: '/membership', end: false, label: 'MEMBERSHIP', icon: ICONS.membership },
    { to: '/wallet', end: false, label: 'WALLET', icon: ICONS.wallet },
    { to: '/chat', end: false, label: 'CHAT', icon: ICONS.chat },
    { to: '/newsfeed', end: false, label: 'NEWSFEED', icon: ICONS.newsfeed },
    { to: '/profile', end: false, label: 'PROFILE', icon: ICONS.profile },
];

// ... existing code ...


export function BottomNav() {
    const { role } = useParams<{ role: string }>();

    // Select the appropriate navigation array based on role
    let NAV = USER_NAV;
    if (role === 'admin') NAV = ADMIN_NAV;
    else if (role === 'provider') NAV = PROVIDER_NAV;

    const basePath = `/${role}/dashboard`;

    return (
        <nav
            style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                width: '100%',
                height: 'calc(64px + env(safe-area-inset-bottom, 0px))',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                background: 'var(--bg-nav)',
                borderTop: '1px solid var(--border-subtle)',
                backdropFilter: 'blur(20px)',
                zIndex: 200,
                boxSizing: 'border-box',
            }}
        >
            <div style={{
                maxWidth: '530px',
                width: '100%',
                height: '64px',
                margin: '0 auto',
                padding: '0 clamp(8px, 3vw, 16px)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxSizing: 'border-box',
            }}>
                {NAV.map(item => (
                    <NavLink
                        key={item.label}
                        to={`${basePath}${item.to}`}
                        end={item.end}
                        style={({ isActive }) => ({
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            flex: 1,
                            padding: '0 2px',
                            gap: '4px',
                            textDecoration: 'none',
                            color: isActive ? 'var(--gold-mid)' : 'var(--text-secondary)',
                            transition: 'all 0.2s ease-in-out',
                            fontSize: 'clamp(0.52rem, 1.8vw, 0.65rem)',
                            letterSpacing: '0.06em',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            textShadow: isActive ? '0 0 10px var(--gold-glow)' : 'none',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                        })}
                    >
                        {({ isActive }) => (
                            <>
                                <span style={{
                                    color: isActive ? 'var(--gold-mid)' : 'var(--text-secondary)',
                                    display: 'flex',
                                    transform: isActive ? 'scale(1.1)' : 'scale(1)',
                                    transition: 'transform 0.2s ease',
                                    filter: isActive ? 'drop-shadow(0 0 8px var(--gold-mid))' : 'none',
                                }}>
                                    {item.icon}
                                </span>
                                <span style={{
                                    textOverflow: 'ellipsis',
                                    overflow: 'hidden',
                                    width: '100%',
                                    textAlign: 'center',
                                }}>
                                    {item.label}
                                </span>
                            </>
                        )}
                    </NavLink>
                ))}
            </div>
        </nav>
    );
}

export function DashboardLayout() {
    return (
        <div style={{
            minHeight: '100svh',
            background: 'var(--bg-main)',
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            maxWidth: '480px',
            margin: '0 auto',
            position: 'relative',
            fontFamily: "'Inter', sans-serif",
            overflowX: 'hidden',
        }}>
            <div style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
            }}>
                <Outlet />
            </div>

            <BottomNav />
        </div>
    );
}
