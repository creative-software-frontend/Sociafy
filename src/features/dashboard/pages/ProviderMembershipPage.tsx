import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TopNav } from './TopNav';
import { userApi, membershipApi } from '../../../utils/api';
import type { Package } from '../../../utils/api';
import { useMembership } from '../../../context/MembershipContext';
import { useToast } from '../../../components/Toast';
import { PointsDisplay } from '../../../components/PointsDisplay';




// ── Animation variants ─────────────────────────────────────────────────────────

const fadeUp = {
    hidden: { opacity: 0, y: 18 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.48, ease: [0.25, 0.46, 0.45, 0.94] as const } },
};

const container = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.1 } },
};



// ── Icons ──────────────────────────────────────────────────────────────────────

const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
        fill="none" stroke="var(--gold-mid)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const LockIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={{ color: 'var(--text-muted)' }}>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
);

// ── Loading Skeleton ───────────────────────────────────────────────────────────

function LoadingSkeleton() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {[0, 1, 2].map(i => (
                <div key={i} style={{
                    borderRadius: '16px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    padding: '32px',
                    animation: `pulse ${1 + i * 0.15}s ease-in-out infinite alternate`,
                    opacity: 0.7,
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                        <div>
                            <div style={{ width: '60px', height: '12px', background: 'var(--bg-input)', borderRadius: '4px', marginBottom: '10px' }} />
                            <div style={{ width: '140px', height: '22px', background: 'var(--bg-input)', borderRadius: '6px' }} />
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ width: '80px', height: '28px', background: 'var(--bg-input)', borderRadius: '6px', marginBottom: '8px' }} />
                            <div style={{ width: '60px', height: '18px', background: 'var(--bg-input)', borderRadius: '999px' }} />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
                        {[0, 1, 2, 3].map(j => (
                            <div key={j} style={{ height: '28px', background: 'var(--bg-input)', borderRadius: '6px' }} />
                        ))}
                    </div>
                    <div style={{ height: '46px', background: 'var(--bg-input)', borderRadius: '10px' }} />
                </div>
            ))}
        </div>
    );
}

// ── Tier Card ──────────────────────────────────────────────────────────────────

function TierCard({ pkg, onPurchased }: { pkg: Package; onPurchased?: () => void }) {

    const toast = useToast();
    const [showModal, setShowModal] = useState(false);
    const [purchasing, setPurchasing] = useState(false);

    const handleProceed = async () => {
        setPurchasing(true);
        const res = await userApi.buyMembership(pkg.id);
        setPurchasing(false);
        if (res.error) {
            toast.error(res.error);
            return;
        }
        setShowModal(false);
        // Refresh membership context so provider-gated features (chat, events…)
        // unlock immediately without a page reload.
        if (onPurchased) await onPurchased();
        toast.success(res.data?.message || `${pkg.name} membership activated successfully.`);
    };

    // Normalize features to { key, display_name, is_coming_soon }
    const featureList: Array<{ key: string; display_name: string; is_coming_soon?: boolean }> =
        Array.isArray(pkg.features)
            ? (pkg.features as Array<{ key: string; display_name: string; is_coming_soon?: boolean }>)
            : [];

    return (
        <>
            <motion.div
                variants={fadeUp}
                className="card gold-top-edge"
                style={{ position: 'relative', padding: '32px clamp(20px, 5vw, 48px)', gap: 0 }}
                onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-gold)';
                    (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-gold)';
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = '';
                    (e.currentTarget as HTMLElement).style.boxShadow = '';
                    (e.currentTarget as HTMLElement).style.transform = '';
                }}
            >
                {/* Card Header row */}
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '16px',
                    borderBottom: '1px solid var(--border-subtle)',
                    paddingBottom: '20px',
                    marginBottom: '20px',
                }}>
                    <div>
                        {/* Eyebrow (no hardcoded tier mapping) */}
                        <span className="eyebrow" style={{ display: 'block', marginBottom: '6px' }}>
                            {pkg.tier_type}
                        </span>

                        <h3 style={{
                            fontSize: 'clamp(1.3rem, 3vw, 1.6rem)',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            margin: 0,
                            lineHeight: 1.2,
                        }}>
                            {pkg.name}
                        </h3>
                        {pkg.description && (
                            <p style={{
                                fontSize: '0.85rem',
                                color: 'var(--text-muted)',
                                margin: '6px 0 0 0',
                                lineHeight: 1.5,
                            }}>
                                {pkg.description}
                            </p>
                        )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                        {/* Price */}
                        <span style={{
                            fontSize: 'clamp(1.6rem, 4vw, 2.2rem)',
                            fontWeight: 800,
                            color: 'var(--gold-mid)',
                            fontFamily: "var(--font-sans)",
                            lineHeight: 1,
                        }}>
                            {Number(pkg.price) === 0 ? 'Free' : <PointsDisplay amount={pkg.price} decimals={0} />}
                        </span>
                        {/* Duration badge */}
                        <span className="badge badge-gold">
                            {pkg.duration_months} Month{pkg.duration_months > 1 ? 's' : ''}
                        </span>
                    </div>
                </div>

                {/* Features list */}
                <div style={{ marginBottom: '24px' }}>
                    <p style={{
                        fontSize: '0.6rem',
                        fontWeight: 700,
                        letterSpacing: '0.25em',
                        textTransform: 'uppercase',
                        color: 'var(--text-muted)',
                        marginBottom: '14px',
                        fontFamily: 'var(--font-display)',
                    }}>
                        Included Benefits
                    </p>
                    {featureList.length > 0 ? (
                        <ul style={{
                            listStyle: 'none',
                            padding: 0,
                            margin: 0,
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '10px',
                        }}>
                            {featureList.map(feat => {
                                const isCS = !!feat.is_coming_soon;
                                return (
                                    <li key={feat.key} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        fontSize: '0.875rem',
                                        color: isCS ? 'var(--text-muted)' : 'var(--text-secondary)',
                                        fontFamily: 'var(--font-sans)',
                                        opacity: isCS ? 0.7 : 1,
                                    }}>
                                        <span style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            background: isCS ? 'var(--bg-input)' : 'var(--gold-glow)',
                                            border: `1px solid ${isCS ? 'var(--border-subtle)' : 'var(--border-gold)'}`,
                                            borderRadius: '50%',
                                            width: '22px',
                                            height: '22px',
                                            flexShrink: 0,
                                        }}>
                                            {isCS ? <LockIcon /> : <CheckIcon />}
                                        </span>
                                        <span style={{ flex: 1 }}>{feat.display_name}</span>
                                        {isCS && (
                                            <span style={{
                                                fontSize: '0.55rem', fontWeight: 700,
                                                padding: '1px 6px', borderRadius: '999px',
                                                background: 'rgba(245,158,11,0.12)',
                                                color: 'var(--gold-mid)',
                                                border: '1px solid rgba(245,158,11,0.3)',
                                                flexShrink: 0,
                                            }}>
                                                Coming Soon
                                            </span>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                            Standard plan benefits apply.
                        </p>
                    )}
                </div>

                {/* CTA Button — reuse site's .btn .btn-primary */}
                <button
                    onClick={() => setShowModal(true)}
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '14px 24px' }}
                >
                    {Number(pkg.price) === 0 ? 'Get Started' : 'Buy Now'}
                </button>
            </motion.div>

            {/* Confirm Plan Modal — matches site modal styling */}
            {showModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'var(--bg-overlay)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 99999,
                    padding: '20px',
                }}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className="card gold-top-edge"
                        style={{ width: '100%', maxWidth: '440px', position: 'relative' }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                            <div>
                                <h3 style={{
                                    fontSize: '1.25rem',
                                    fontWeight: 700,
                                    color: 'var(--text-primary)',
                                    margin: '0 0 4px 0',
                                }}>
                                    Confirm Plan
                                </h3>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                                    Review pricing breakdown
                                </p>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                className="btn btn-ghost btn-sm"
                                style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    padding: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        <div style={{
                            background: 'var(--bg-input)',
                            borderRadius: '12px',
                            padding: '16px',
                            marginBottom: '20px',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{pkg.name}</span>
                                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                    {Number(pkg.price) === 0 ? 'Free' : <PointsDisplay amount={pkg.price} decimals={0} />}
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Duration</span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    {pkg.duration_months} Month{pkg.duration_months > 1 ? 's' : ''}
                                </span>
                            </div>
                        </div>

                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 20px', lineHeight: 1.5 }}>
                            Your provider features will unlock immediately after purchase.
                        </p>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={() => setShowModal(false)}
                                className="btn btn-ghost"
                                style={{ flex: 1, padding: '12px' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleProceed}
                                disabled={purchasing}
                                className="btn btn-primary"
                                style={{ flex: 1, padding: '12px' }}
                            >
                                {purchasing ? 'Processing…' : 'Confirm Purchase'}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </>
    );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState() {
    return (
        <motion.div
            variants={fadeUp}
            style={{
                textAlign: 'center', padding: '64px 24px',
                background: 'var(--bg-card)', border: '1px dashed var(--border-subtle)',
                borderRadius: '16px',
            }}
        >
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>👑</div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                No provider packages available
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '300px', margin: '0 auto' }}>
                Please check again later.
            </p>
        </motion.div>
    );
}


// ── ProviderMembershipPage ─────────────────────────────────────────────────────

export function ProviderMembershipPage() {
    const [packages, setPackages] = useState<Package[]>([]);
    const { membership, refreshMembership } = useMembership();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const toast = useToast();

    // Active membership = provider is on a paid plan (not the FREE starter)
    const hasActiveMembership =
        !!membership.package && membership.package.toLowerCase() !== 'free';

    // DB-driven feature display names (from features.display_name).
    // Fall back to the raw feature keys with underscores replaced if the
    // backend did not return display names.
    const activeFeatureLabels: string[] =
        (membership.features_display && membership.features_display.length > 0)
            ? membership.features_display
            : membership.features.map(f => f.replace(/_/g, ' '));

    const handleCancelConfirm = async () => {
        setCancelling(true);
        try {
            const res = await userApi.cancelMembership();
            if (res.error) {
                toast.error(res.error);
                return;
            }
            // Refresh membership context + status so the provider immediately
            // reverts to FREE and provider-gated features become locked again.
            await refreshMembership();
            setShowCancelModal(false);
            toast.success('Membership cancelled successfully. You are now using the Free plan.');
        } catch {
            toast.error('Failed to cancel membership. Please try again.');
        } finally {
            setCancelling(false);
        }
    };

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                const res = await membershipApi.getProviderPackages();

                if (cancelled) return;

                // Trace runtime payload and ensure provider endpoint drives this page
                console.log('[ProviderMembershipPage api raw]', res);

                if (res && typeof res === 'object' && 'error' in res && (res as { error?: string }).error) {
                    setPackages([]);
                    return;
                }

                const providerPackages = (res as { data?: Package[] }).data ?? [];
                console.log('[ProviderMembershipPage packages]', providerPackages);
                setPackages(providerPackages);
            } catch (e: unknown) {
                const err = e instanceof Error ? e : new Error('Provider packages fetch failed');
                if (cancelled) return;
                setError(err.message || 'Provider packages fetch failed');
                setPackages([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, []);


    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={container}
            style={{ minHeight: '100%', background: 'var(--bg-main)', paddingBottom: '32px' }}
        >
            <TopNav />
            <div style={{ padding: '100px 16px 16px', maxWidth: '860px', margin: '0 auto' }}>

                {/* Header */}
                <motion.div variants={fadeUp} style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: '56px', height: '56px', borderRadius: '16px',
                        background: 'var(--gold-glow)', border: '1px solid var(--border-gold)',
                        marginBottom: '16px',
                    }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--gold-mid)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01z" />
                        </svg>
                    </div>
                    <h2 style={{
                        fontFamily: "'Inter', sans-serif", fontWeight: 800,
                        fontSize: 'clamp(1.6rem, 4vw, 2.1rem)',
                        color: 'var(--text-primary)', marginBottom: '8px', lineHeight: 1.1,
                    }}>
                        Provider Membership Plans
                    </h2>
                    <p style={{
                        fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase',
                        color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif", fontWeight: 700,
                    }}>
                        Grow your business · Unlock premium provider tools
                    </p>
                </motion.div>

                {/* ── Current Plan Status ─────────────────────────────────── */}
                {membership && (
                    <motion.div variants={fadeUp} style={{
                        background: 'linear-gradient(135deg, rgba(245,158,11,0.10), rgba(245,158,11,0.04))',
                        border: '1px solid rgba(245,158,11,0.25)',
                        borderRadius: 16, padding: '20px 24px', marginBottom: 24,
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                            <div>
                                <p style={{ margin: '0 0 4px', fontSize: '0.6rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>Current Membership</p>
                                <p style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#fff', fontFamily: "'Inter', sans-serif" }}>{membership.package}</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <p style={{ margin: '0 0 2px', fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', fontWeight: 700 }}>Status</p>
                                <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: hasActiveMembership ? 'var(--green-status)' : 'var(--text-muted)' }}>
                                    {hasActiveMembership ? 'Active' : 'Inactive'}
                                </p>
                            </div>
                        </div>

                        {hasActiveMembership && membership.expires_at && (
                            <div style={{ marginTop: 12 }}>
                                <p style={{ margin: '0 0 2px', fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', fontWeight: 700 }}>Expires</p>
                                <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                                    {new Date(membership.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </p>
                            </div>
                        )}

                        {hasActiveMembership && activeFeatureLabels.length > 0 && (
                            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                                <p style={{ margin: '0 0 10px', fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', fontWeight: 700 }}>Active Features</p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {activeFeatureLabels.map(f => (
                                        <span key={f} style={{
                                            padding: '4px 12px', borderRadius: 999,
                                            background: 'rgba(245,158,11,0.12)',
                                            border: '1px solid rgba(245,158,11,0.25)',
                                            fontSize: '0.72rem', fontWeight: 700,
                                            color: 'var(--gold-mid)', letterSpacing: '0.04em',
                                        }}>
                                            ✓ {f}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Cancel Membership — only for active (paid) providers */}
                        {hasActiveMembership && (
                            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                                <button
                                    onClick={() => setShowCancelModal(true)}
                                    className="btn btn-ghost btn-sm"
                                    style={{
                                        borderColor: 'rgba(239,68,68,0.5)',
                                        color: '#f87171',
                                        fontWeight: 700,
                                    }}
                                >
                                    Cancel Membership
                                </button>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* Info notice */}
                <motion.div
                    variants={fadeUp}
                    className="card"
                    style={{
                        background: 'var(--blue-glow)', border: '1px solid var(--border-subtle)',
                        borderRadius: '12px', padding: '16px', marginBottom: '28px',
                    }}
                >
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                            stroke="var(--blue-vivid)" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}>
                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                        <p style={{
                            color: 'var(--text-secondary)', fontSize: '0.85rem',
                            lineHeight: '1.6', fontFamily: "'Inter', sans-serif", fontWeight: 500, margin: 0,
                        }}>
                            Choose a plan to unlock provider tools. Features marked <strong style={{ color: 'var(--gold-mid)' }}>Coming Soon</strong> are included in your plan and will activate as soon as they're released.
                        </p>
                    </div>
                </motion.div>

                {/* Error state */}
                {error && (
                    <motion.div variants={fadeUp} className="card" style={{
                        padding: '16px', borderRadius: '12px', marginBottom: '24px',
                        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                        color: '#fca5a5', fontSize: '0.85rem',
                    }}>
                        ⚠ {error}
                    </motion.div>
                )}

                {/* Package cards */}
                {loading ? (
                    <LoadingSkeleton />
                ) : packages.length === 0 ? (
                    <EmptyState />
                ) : (
                    <motion.div
                        variants={container}
                        style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}
                    >
                        {packages.map((pkg) => (
                            <TierCard key={pkg.id} pkg={pkg} onPurchased={refreshMembership} />
                        ))}
                    </motion.div>
                )}
            </div>

            {/* Cancel Membership Confirmation Modal */}
            {showCancelModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'var(--bg-overlay)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 99999,
                    padding: '20px',
                }}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className="card gold-top-edge"
                        style={{ width: '100%', maxWidth: '440px', position: 'relative' }}
                    >
                        <div style={{ marginBottom: '20px' }}>
                            <h3 style={{
                                fontSize: '1.25rem',
                                fontWeight: 700,
                                color: 'var(--text-primary)',
                                margin: '0 0 12px 0',
                            }}>
                                Cancel Membership
                            </h3>
                            <p style={{
                                fontSize: '0.9rem',
                                color: 'var(--text-secondary)',
                                lineHeight: 1.6,
                                margin: 0,
                            }}>
                                Are you sure you want to cancel your membership?
                                This action will remove your membership immediately and does not refund your payment.
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setShowCancelModal(false)}
                                className="btn btn-ghost btn-sm"
                                disabled={cancelling}
                            >
                                Keep Membership
                            </button>
                            <button
                                onClick={handleCancelConfirm}
                                className="btn btn-primary btn-sm"
                                disabled={cancelling}
                                style={{
                                    background: '#dc2626',
                                    borderColor: '#dc2626',
                                    color: '#fff',
                                }}
                            >
                                {cancelling ? 'Cancelling…' : 'Yes, Cancel'}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </motion.div>
    );
}