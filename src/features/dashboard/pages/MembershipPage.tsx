import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TopNav } from './TopNav';
import { userApi, membershipApi } from '../../../utils/api';

import type { Package, PackageFeature } from '../../../utils/api';
import { useMembership } from '../../../context/MembershipContext';
import { useToast } from '../../../components/Toast';
import { PointsDisplay } from '../../../components/PointsDisplay';


// ── Animation variants ────────────────────────────────────────────────────────

const fadeUp = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const } },
};

const container = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.12 } },
};

// ── Small helpers ─────────────────────────────────────────────────────────────

const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
        fill="none" stroke="var(--gold-mid)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);



// ── Tier Card ─────────────────────────────────────────────────────────────────

function TierCard({ pkg, onPurchased }: { pkg: Package; onPurchased?: () => void }) {
    const [showModal, setShowModal] = useState(false);
    const toast = useToast();

    // Handle both normalized PackageFeature[] and legacy CSV string
    const featureList: string[] = Array.isArray(pkg.features)
        ? (pkg.features as PackageFeature[]).map(f => f.display_name || f.key)
        : typeof pkg.features === 'string'
            ? pkg.features.split(',').map(f => f.trim()).filter(Boolean)
            : [];

    const handleCTA = () => {
        if (Number(pkg.price) === 0) {
            toast.info("Proceeding with Free Starter plan registration...");
        } else {
            setShowModal(true);
        }
    };

    const handleProceed = async () => {
        const payload = pkg?.id;
        console.log("Buying membership:", payload);
        const res = await userApi.buyMembership(pkg.id);
        if (res.error) {
            toast.error(res.error);
            return;
        }

        // Refresh membership context so Silver-gated features (search/chat)
        // unlock immediately without a page reload.
        if (onPurchased) await onPurchased();
        setShowModal(false);
        // Prefer the backend's rule-specific message (extend vs upgrade);
        // fall back to a generic success message.
        toast.success(res.data?.message || `${pkg.name} membership activated successfully.`);
    };


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
                            {featureList.map(feat => (
                                <li key={feat} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    fontSize: '0.875rem',
                                    color: 'var(--text-secondary)',
                                    fontFamily: 'var(--font-sans)',
                                }}>
                                    <span style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: 'var(--gold-glow)',
                                        border: '1px solid var(--border-gold)',
                                        borderRadius: '50%',
                                        width: '22px',
                                        height: '22px',
                                        flexShrink: 0,
                                    }}>
                                        <CheckIcon />
                                    </span>
                                    {feat}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                            Standard plan benefits apply.
                        </p>
                    )}
                </div>

                {/* CTA Button — reuse site's .btn .btn-primary */}
                <button
                    onClick={handleCTA}
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '14px 24px' }}
                >
                    {Number(pkg.price) === 0 ? 'Get Started' : 'Buy Now'}
                </button>
            </motion.div>

            {/* Confirm Plan Modal */}
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
                        {/* Modal Header */}
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

                        {/* Plan Summary */}
                        <div style={{
                            background: 'var(--bg-input)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-lg)',
                            padding: '20px',
                            marginBottom: '24px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                        }}>
                            {[
                                { label: 'Plan', value: pkg.name },
                                { label: 'Duration', value: `${pkg.duration_months} Month${pkg.duration_months > 1 ? 's' : ''}` },
                            ].map(row => (
                                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>{row.label}</span>
                                    <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600 }}>{row.value}</span>
                                </div>
                            ))}
                            <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '4px 0' }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>Monthly</span>
                                <span style={{ fontSize: '1.1rem', color: 'var(--green-status)', fontWeight: 800 }}>
                                    <PointsDisplay amount={Math.round(Number(pkg.price) / pkg.duration_months)} decimals={0} />
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}> / mo</span>
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>Total</span>
                                <span style={{ fontSize: '0.95rem', color: 'var(--gold-mid)', fontWeight: 700 }}><PointsDisplay amount={pkg.price} decimals={0} /></span>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowModal(false)} className="btn btn-ghost btn-sm">
                                Cancel
                            </button>
                            <button onClick={handleProceed} className="btn btn-primary btn-sm">
                                Confirm &amp; Pay
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </>
    );
}

// ── MembershipPage ────────────────────────────────────────────────────────────


export function MembershipPage() {
    const [packages, setPackages] = useState<Package[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const { membership, refreshMembership } = useMembership();
    const toast = useToast();

    // Active membership = user is on a paid plan (not the FREE starter)
    const hasActiveMembership =
        !!membership.package && membership.package.toLowerCase() !== 'free';

    const handleCancelConfirm = async () => {
        setCancelling(true);
        try {
            const res = await userApi.cancelMembership();
            if (res.error) {
                toast.error(res.error);
                return;
            }
            // Refresh membership context + status so the user immediately
            // reverts to FREE and Silver features become locked again.
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
                // User-only package catalog
                const res = await membershipApi.getUserPackages();
                console.log("[USER API RESPONSE]", res);
                if (cancelled) return;
                if (res && typeof res === 'object' && 'error' in res && (res as { error?: string }).error) {
                    setPackages([]);
                    console.log('[MembershipPage packages after fetch]', []);
                    return;
                }
                setPackages((res as { data?: Package[] }).data ?? []);
                console.log('[MembershipPage packages after fetch]', (res as { data?: Package[] }).data ?? []);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, []);



    // Sort packages by DB-driven membership_level ascending (Silver -> Gold -> Platinum)
    const sortedPackages = [...packages].sort((a, b) => {
        const levelA = a.membership_level != null ? Number(a.membership_level) : 99;
        const levelB = b.membership_level != null ? Number(b.membership_level) : 99;
        if (levelA !== levelB) return levelA - levelB;
        return Number(a.price) - Number(b.price);
    });

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={container}
            style={{ minHeight: '100%', background: 'var(--bg-main)', paddingBottom: '32px' }}
        >
            <TopNav />
            <div style={{ padding: '100px 16px 16px', maxWidth: '900px', margin: '0 auto' }}>

                {/* Header */}
                <motion.div variants={fadeUp} style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <h2 style={{
                        fontFamily: "'Inter', sans-serif", fontWeight: 700,
                        fontSize: '1.75rem', color: 'var(--text-primary)', marginBottom: '6px',
                    }}>
                        Membership
                    </h2>
                    <p style={{
                        fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase',
                        color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif", fontWeight: 700,
                    }}>
                        CHOOSE A PLAN THAT FITS YOU
                    </p>
                </motion.div>

                {/* Bangla Notice */}

                {/* ── Current Plan Status ─────────────────────────────────── */}
                {membership && (
                    <motion.div variants={fadeUp} style={{
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.08))',
                        border: '1px solid rgba(99,102,241,0.2)',
                        borderRadius: 16, padding: '20px 24px', marginBottom: 24,
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                            <div>
                                <p style={{ margin: '0 0 4px', fontSize: '0.6rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>Current Plan</p>
                                <p style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#fff', fontFamily: "'Inter', sans-serif" }}>{membership.package}</p>
                            </div>
                            {membership.expires_at && (
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{ margin: '0 0 2px', fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', fontWeight: 700 }}>Expires</p>
                                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                                        {new Date(membership.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </p>
                                </div>
                            )}
                        </div>

                        {membership.features.length > 0 && (
                            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                                <p style={{ margin: '0 0 10px', fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', fontWeight: 700 }}>Active Features</p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {membership.features.map(f => (
                                        <span key={f} style={{
                                            padding: '4px 12px', borderRadius: 999,
                                            background: 'rgba(99,102,241,0.12)',
                                            border: '1px solid rgba(99,102,241,0.25)',
                                            fontSize: '0.72rem', fontWeight: 700,
                                            color: '#818cf8', letterSpacing: '0.04em',
                                        }}>
                                            ✓ {f.replace(/_/g, ' ')}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                {/* Feature preview is DB-driven via /membership/status. No hardcoded coming-soon gates. */}

                        {/* Cancel Membership — only for active (paid) members */}
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

                {/* Bangla Notice */}
                <motion.div
                    variants={fadeUp}
                    style={{
                        background: 'var(--blue-glow)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '12px',
                        padding: '16px',
                        marginBottom: '24px',
                        position: 'relative',
                    }}
                >
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                            stroke="var(--blue-vivid)" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}>
                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                        <p style={{
                            color: 'var(--text-secondary)', fontSize: '0.85rem',
                            lineHeight: '1.6', fontFamily: "'Inter', sans-serif", fontWeight: 500,
                        }}>
                            মেম্বারশিপের কোনো অতিরিক্ত ফি নেই। মেম্বারশিপের পেমেন্টকৃত সম্পূর্ণ টাকা আপনার ওয়ালেটে জমা হবে যা দিয়ে আপনি পরবর্তীতে যেকোনো সার্ভিস বুক করতে পারবেন।
                        </p>
                    </div>
                </motion.div>

                {/* Loading shimmer */}
                {loading && (
                    <motion.div variants={fadeUp} style={{ textAlign: 'center', padding: '20px 0', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                            {[0, 1, 2].map(i => (
                                <div key={i} style={{
                                    width: '8px', height: '8px', borderRadius: '50%',
                                    background: 'var(--blue-vivid)',
                                    animation: `pulse ${0.8 + i * 0.2}s ease-in-out infinite alternate`,
                                    opacity: 0.6,
                                }} />
                            ))}
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: "'Inter', sans-serif", marginTop: '8px' }}>
                            Loading latest plans…
                        </p>
                    </motion.div>
                )}

                {/* Tier cards stacked vertically in one column */}
                {!loading && sortedPackages.length === 0 ? (
                    <motion.div variants={fadeUp} style={{ textAlign: 'center', padding: '32px 0' }}>
                        <p style={{
                            color: 'var(--text-secondary)',
                            fontSize: '0.95rem',
                            margin: 0,
                            fontFamily: "'Inter', sans-serif",
                            fontWeight: 600,
                        }}>
                            No membership packages are currently available.
                        </p>
                    </motion.div>
                ) : (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '24px',
                        width: '100%',
                    }}>
                        {sortedPackages.map(pkg => (
                            <TierCard key={pkg.id} pkg={pkg} onPurchased={refreshMembership} />
                        ))}
                    </div>
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