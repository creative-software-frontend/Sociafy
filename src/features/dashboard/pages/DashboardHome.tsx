import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopNav } from './TopNav';
import { providerApi, userApi, type PartnerRequestStatus } from '../../../utils/api';
import { useAuth } from '../../../context/AuthContext';
import { useMembership } from '../../../context/MembershipContext';
import { useToast } from '../../../components/Toast';
import { ProfileDetailsModal } from './partner/ProfileDetailsModal';
import { WelcomeCard } from './home/components/WelcomeCard';
import { StatsRow } from './home/components/StatsRow';
import { QuickLinksGrid } from './home/components/QuickLinksGrid';
import { RecentActivityCard } from './home/components/RecentActivityCard';
import { FeaturedProfiles } from './home/components/FeaturedProfiles';
import { FeaturedLocations } from './home/components/FeaturedLocations';
import { AdminHome } from './home/components/AdminHome';

export interface FeaturedProfile {
    id: number;
    name: string;
    avatar_url: string | null;
    profession: string | null;
    location: string | null;
    interests?: string | null;
    date_of_birth?: string | null;
    membership_package?: string | null;
}

export interface FeaturedLocation {
    location: string;
    event_count: number;
    next_event: string | null;
}

export interface RecentEvent {
    id: number;
    title: string;
    description: string | null;
    date_time: string;
    location: string;
    capacity: number;
    status: string;
    created_at: string;
    host_name: string | null;
    entry_fee: number;
}

export function DashboardHome() {
    const { role } = useParams<{ role: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { membership } = useMembership();
    const toast = useToast();

    const isProviderDashboard = role === 'provider';
    const isUserDashboard = role === 'user';
    const isAdminDashboard = role === 'admin';
    const showOnlineCard = isProviderDashboard || isUserDashboard;

    const [profiles, setProfiles] = useState<FeaturedProfile[]>([]);
    const [profilesLoading, setProfilesLoading] = useState(false);
    const [locations, setLocations] = useState<FeaturedLocation[]>([]);
    const [locationsLoading, setLocationsLoading] = useState(false);
    const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
    const [userActivity, setUserActivity] = useState<any[]>([]);
    const [userActivityLoading, setUserActivityLoading] = useState(false);


    const [onlineList, setOnlineList] = useState<
        Array<{ id: number; name: string; last_seen: string | null; is_online: number }>
    >([]);
    const [onlineLoading, setOnlineLoading] = useState(false);
    const [onlineError, setOnlineError] = useState<string | null>(null);
    const [onlineOpen, setOnlineOpen] = useState(false);
    const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
    const [featuredStatusById, setFeaturedStatusById] = useState<Map<number, PartnerRequestStatus | null>>(new Map());

    // The currently selected featured profile passed to the shared View Profile modal.
    const selectedProfile = useMemo(
        () => (selectedProfileId != null ? profiles.find((p) => p.id === selectedProfileId) ?? null : null),
        [selectedProfileId, profiles]
    );

    const handleSelectProfile = (id: number) => {
        // Reset status so the modal never shows stale data from a previous profile.
        setFeaturedStatusById(new Map());
        setSelectedProfileId(id);
    };

    // Load the partner-request status for the selected featured profile so the
    // shared View Profile modal shows the correct button state. Users check via
    // the user status endpoint; providers read the requester profile's status.
    useEffect(() => {
        if (selectedProfileId == null) return;
        let cancelled = false;
        const load = async () => {
            let status: PartnerRequestStatus | null = null;
            if (isUserDashboard) {
                const res = await userApi.getPartnerRequestStatus(selectedProfileId);
                status = res.data?.status ?? null;
            } else {
                const res = await providerApi.getRequesterProfile(selectedProfileId);
                status = res.data?.partner_status ?? null;
            }
            if (!cancelled) {
                setFeaturedStatusById((prev) => {
                    const next = new Map(prev);
                    next.set(selectedProfileId, status);
                    return next;
                });
            }
        };
        load();
        return () => { cancelled = true; };
    }, [selectedProfileId, isUserDashboard]);

    const handleFeaturedRequest = async (id: number) => {
        if (!isUserDashboard) {
            toast.info('Partner requests are sent from the user side.');
            return;
        }
        const res = await userApi.sendPartnerRequest(id);
        if (res.error) {
            toast.error(res.error);
            return;
        }
        setFeaturedStatusById((prev) => {
            const next = new Map(prev);
            next.set(id, res.data?.status ?? 'pending');
            return next;
        });
    };

    const onlineCount = useMemo(() => onlineList.length, [onlineList]);
    // Label: providers see "Active Users", users see "Active Providers"
    const onlineModalTitle = isProviderDashboard ? 'Active Users' : 'Active Providers';
    const onlineUnitSingular = isProviderDashboard ? 'user' : 'provider';
    const onlineUnitPlural = isProviderDashboard ? 'users' : 'providers';

    const loadOnlineList = async () => {
        try {
            setOnlineLoading(true);
            setOnlineError(null);
            // Providers see online users; users see online providers
            const res = isProviderDashboard
                ? await providerApi.getOnlineUsers()
                : await providerApi.getOnlineProviders();
            if (res.error) throw new Error(res.error);
            setOnlineList(res.data || []);
        } catch (e: any) {
            setOnlineError(e?.message || 'Failed to load online list');
        } finally {
            setOnlineLoading(false);
        }
    };

    useEffect(() => {
        if (!showOnlineCard) return;

        loadOnlineList();
        const interval = window.setInterval(loadOnlineList, 10_000);
        return () => window.clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showOnlineCard, isProviderDashboard]);

    // Fetch dynamic data for provider dashboard
    useEffect(() => {
        if (!isProviderDashboard) return;

        const loadProfiles = async () => {
            try {
                setProfilesLoading(true);
                const res = await providerApi.getFeaturedProfiles();
                if (!res.error) setProfiles(res.data || []);
            } catch {
                // keep empty — static fallback not shown
            } finally {
                setProfilesLoading(false);
            }
        };

        const loadLocations = async () => {
            try {
                setLocationsLoading(true);
                const res = await providerApi.getFeaturedLocations();
                if (!res.error) setLocations(res.data || []);
            } catch {
                // keep empty
            } finally {
                setLocationsLoading(false);
            }
        };

        const loadRecentEvents = async () => {
            try {
                const res = await providerApi.getRecentEvents();
                if (!res.error) setRecentEvents(res.data || []);
            } catch {
                // keep empty
            }
        };

        loadProfiles();
        loadLocations();
        loadRecentEvents();
    }, [isProviderDashboard]);

    // Fetch dynamic data for user dashboard
    useEffect(() => {
        if (!isUserDashboard) return;

        const loadFeaturedProviders = async () => {
            try {
                setProfilesLoading(true);
                const res = await userApi.getFeaturedProviders();
                if (!res.error) setProfiles(res.data || []);
            } catch {
                // keep empty
            } finally {
                setProfilesLoading(false);
            }
        };

        const loadEventLocations = async () => {
            try {
                setLocationsLoading(true);
                const res = await userApi.getEventLocations();
                if (!res.error) setLocations(res.data || []);
            } catch {
                // keep empty
            } finally {
                setLocationsLoading(false);
            }
        };

        const loadUserActivity = async () => {
            try {
                setUserActivityLoading(true);
                const res = await userApi.getRecentActivity();
                if (!res.error) setUserActivity(res.data || []);
            } catch {
                // keep empty
            } finally {
                setUserActivityLoading(false);
            }
        };

        loadFeaturedProviders();
        loadEventLocations();
        loadUserActivity();
    }, [isUserDashboard]);

    if (isAdminDashboard) {
        return (
            <div style={{ background: 'var(--bg-root)', minHeight: '100svh', overflowX: 'hidden' }}>
                <TopNav />
                <div style={{ padding: 'clamp(80px, 22vw, 100px) clamp(12px, 4vw, 16px) 16px', width: '100%', boxSizing: 'border-box' }}>
                    <AdminHome />
                </div>
            </div>
        );
    }

    return (
        <div style={{ background: 'var(--bg-root)', minHeight: '100svh', overflowX: 'hidden' }}>
            <TopNav />

            {/* Content sits below fixed TopNav — clamp keeps padding fluid */}
            <div style={{
                padding: 'clamp(80px, 22vw, 100px) clamp(12px, 4vw, 16px) 16px',
                width: '100%',
                boxSizing: 'border-box',
            }}>

                {/* ── Welcome card ── */}
                <WelcomeCard role={role} userName={user?.username} membershipPackage={membership.package} />





                {/* ── Stats row ── */}
                <StatsRow
                    showOnlineCard={showOnlineCard}
                    onlineCount={onlineCount}
                    setOnlineOpen={setOnlineOpen}
                    membershipPackage={membership.package}
                    role={role}
                />


                {/* ── Quick links ── */}
                <QuickLinksGrid role={role} />


                {/* ── Recent Activity ── */}
                <RecentActivityCard
                    role={role}
                    recentEvents={isProviderDashboard ? recentEvents : []}
                    userActivity={isUserDashboard ? userActivity : []}
                    userActivityLoading={isUserDashboard ? userActivityLoading : false}
                />


                {/* ── Featured Profiles ── */}
                <FeaturedProfiles
                    profiles={profiles}
                    loading={profilesLoading}
                    isUser={isUserDashboard}
                    onSelect={handleSelectProfile}
                />


                {/* ── Featured Locations ── */}
                <FeaturedLocations
                    locations={locations}
                    loading={locationsLoading}
                    isUser={isUserDashboard}
                />

            </div>

            {/* Active Users Modal */}
            {onlineOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'var(--bg-overlay)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    padding: '20px',
                    animation: 'fadeIn 0.25s var(--ease-default)',
                }}>
                    <div style={{
                        background: 'linear-gradient(135deg, var(--bg-card-hover) 0%, var(--bg-card) 100%)',
                        border: '1px solid var(--border-gold)',
                        borderRadius: '16px',
                        width: '100%',
                        maxWidth: '440px',
                        padding: '24px',
                        boxShadow: 'var(--shadow-gold)',
                        position: 'relative',
                        animation: 'scaleIn 0.3s var(--ease-spring)',
                    }}>
                        {/* Top accent line */}
                        <div style={{
                            position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
                            background: 'linear-gradient(90deg, transparent, var(--gold-mid), transparent)',
                        }} />

                        {/* Modal Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div>
                                <h3 style={{
                                    fontFamily: 'var(--font-serif)',
                                    fontSize: '1.5rem',
                                    color: 'var(--text-primary)',
                                    marginBottom: '4px',
                                }}>
                                    {onlineModalTitle}
                                </h3>
                                <p style={{
                                    fontSize: '0.75rem',
                                    color: 'var(--green-status)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontWeight: 600,
                                }}>
                                    <span style={{
                                        display: 'inline-block',
                                        width: 8,
                                        height: 8,
                                        borderRadius: '50%',
                                        background: 'var(--green-status)',
                                        boxShadow: '0 0 8px var(--green-status)',
                                    }} />
                                    {onlineCount} {onlineCount === 1 ? onlineUnitSingular : onlineUnitPlural} online
                                </p>
                            </div>
                            <button
                                onClick={() => setOnlineOpen(false)}
                                style={{
                                    background: 'var(--blue-dim)',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: '50%',
                                    width: '32px',
                                    height: '32px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.color = 'var(--gold-mid)';
                                    e.currentTarget.style.borderColor = 'var(--gold-mid)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.color = 'var(--text-secondary)';
                                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div style={{
                            maxHeight: '300px',
                            overflowY: 'auto',
                            paddingRight: '4px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                        }}>
                            {onlineLoading && (
                                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px 0' }}>
                                    Loading...
                                </p>
                            )}
                            
                            {onlineError && (
                                <p style={{ textAlign: 'center', color: 'var(--red-status)', padding: '20px 0' }}>
                                    {onlineError}
                                </p>
                            )}

                            {!onlineLoading && !onlineError && onlineList.length === 0 && (
                                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px 0' }}>
                                    No {onlineUnitPlural} are currently online.
                                </p>
                            )}

                            {!onlineLoading && !onlineError && onlineList.map((u) => {
                                const initials = u.name ? u.name.substring(0, 2).toUpperCase() : 'U';
                                return (
                                    <div
                                        key={u.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => { setOnlineOpen(false); navigate(`/${role}/dashboard/chat?partner=${u.id}`); }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                setOnlineOpen(false);
                                                navigate(`/${role}/dashboard/chat?partner=${u.id}`);
                                            }
                                        }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '14px',
                                            padding: '12px',
                                            background: 'var(--bg-input)',
                                            border: '1px solid var(--border-subtle)',
                                            borderRadius: '10px',
                                            cursor: 'pointer',
                                            transition: 'border-color 0.2s',
                                            outline: 'none',
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--gold-mid)'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                                    >
                                        {/* Avatar with status indicator */}
                                        <div style={{ position: 'relative' }}>
                                            <div style={{
                                                width: '40px',
                                                height: '40px',
                                                borderRadius: '50%',
                                                background: 'linear-gradient(135deg, var(--blue-neon), var(--gold-deep))',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: '#fff',
                                                fontWeight: 700,
                                                fontSize: '0.9rem',
                                                fontFamily: 'var(--font-display)',
                                                border: '1px solid var(--gold-border)',
                                            }}>
                                                {initials}
                                            </div>
                                            <span style={{
                                                position: 'absolute',
                                                bottom: 0,
                                                right: 0,
                                                width: 10,
                                                height: 10,
                                                borderRadius: '50%',
                                                background: 'var(--green-status)',
                                                border: '2px solid var(--bg-card)',
                                                boxShadow: '0 0 6px var(--green-status)',
                                            }} />
                                        </div>

                                        <div style={{ flex: 1 }}>
                                            <p style={{
                                                color: 'var(--text-primary)',
                                                fontWeight: 600,
                                                fontSize: '0.95rem',
                                                fontFamily: 'var(--font-sans)',
                                                marginBottom: '2px',
                                            }}>
                                                {u.name}
                                            </p>
                                            <p style={{
                                                color: 'var(--text-muted)',
                                                fontSize: '0.75rem',
                                            }}>
                                                ID: #{u.id} • Active now
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Modal Footer */}
                        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setOnlineOpen(false)}
                                style={{
                                    background: 'var(--gold-mid)',
                                    color: '#000',
                                    padding: '8px 16px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    borderRadius: '6px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    cursor: 'pointer',
                                    boxShadow: '0 0 8px rgba(197, 168, 128, 0.4)',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.filter = 'brightness(1.1)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.filter = 'none';
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Featured Profile Details Modal (shared View Profile component) */}
            <ProfileDetailsModal
                open={selectedProfileId !== null}
                profile={selectedProfile}
                statusById={featuredStatusById}
                onRequest={handleFeaturedRequest}
                onClose={() => setSelectedProfileId(null)}
            />
        </div>
    );
}