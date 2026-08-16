import { motion } from "framer-motion";
import { PointsDisplay } from "../../../components/PointsDisplay";

const fadeUp = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] as const } },
};

const container = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.15 } },
};

const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const XIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

const tiers = [
    {
        id: 'demo',
        tag: 'Demo Access',
        name: 'Free',
        features: [
            { label: 'Basic Platform Access', included: true },
            { label: 'View Demo Profiles', included: true },
            { label: 'Hotel Access', included: false },
            { label: 'Party Schedules', included: false },
        ],
        cta: 'Register Free',
        featured: false,
    },
    {
        id: 'premium',
        tag: 'Premium Elite',
        name: '22000',
        features: [
            { label: 'Lifetime VIP Status', included: true },
            { label: 'Full Elite Profile Access', included: true },
            { label: '5-Star Hotel Clearance', included: true },
            { label: 'Underground Party Registration', included: true },
            { label: '30% Booking Offset', included: true },
        ],
        cta: 'Acquire Premium',
        featured: true,
    },
    {
        id: 'regular',
        tag: 'Regular Standard',
        name: '12000',
        features: [
            { label: 'Lifetime Access', included: true },
            { label: 'Regular Profile Access', included: true },
            { label: 'Standard Hotel Clearance', included: true },
            { label: '10% Booking Offset', included: true },
        ],
        cta: 'Acquire Regular',
        featured: false,
    },
];

export function MembershipTiers() {
    return (
        <section id="tiers" style={{
            padding: 'clamp(56px, 8vw, 96px) clamp(16px, 4vw, 32px)',
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* bg glows */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                <div style={{
                    position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
                    width: '900px', height: '400px', borderRadius: '50%',
                    background: 'rgba(120, 80, 20, 0.06)', filter: 'blur(140px)',
                }} />
                <div style={{
                    position: 'absolute', top: 0, left: '20%',
                    width: '500px', height: '300px', borderRadius: '50%',
                    background: 'rgba(29, 78, 216, 0.05)', filter: 'blur(100px)',
                }} />
            </div>

            <div style={{ position: 'relative', zIndex: 10, maxWidth: '1100px', margin: '0 auto' }}>

                {/* Divider ornament */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '16px',
                    marginBottom: '64px', textAlign: 'center',
                    color: 'var(--text-muted)', fontSize: '0.55rem', letterSpacing: '0.25em', textTransform: 'uppercase',
                    fontFamily: "'Inter', sans-serif", fontWeight: 600,
                }}>
                    <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, var(--gold-border), transparent)' }} />
                    Unlock Unrestricted Reality
                    <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, var(--gold-border), transparent)' }} />
                </div>

                {/* Section header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }} transition={{ duration: 0.7 }}
                    style={{ textAlign: 'center', marginBottom: '56px' }}
                >
                    <h2 style={{
                        fontFamily: "'Cormorant Garamond', serif", fontWeight: 300,
                        fontSize: 'clamp(1.8rem, 5vw, 3.2rem)', color: 'var(--text-primary)', marginBottom: '12px',
                        letterSpacing: '-0.01em',
                    }}>
                        Membership Tiers
                    </h2>
                    <span style={{
                        display: 'block',
                        fontSize: '0.6rem', letterSpacing: '0.25em', textTransform: 'uppercase',
                        color: 'var(--gold-mid)', fontFamily: "'Inter', sans-serif", fontWeight: 600,
                    }}>
                        Unlock Unrestricted Reality
                    </span>
                    <div style={{
                        width: '48px', height: '1px', margin: '20px auto 0',
                        background: 'linear-gradient(90deg, transparent, var(--gold-mid), transparent)',
                    }} />
                </motion.div>

                {/* Cards */}
                <motion.div
                    className="tiers-grid"
                    variants={container} initial="hidden" whileInView="visible"
                    viewport={{ once: true }}
                >
                    {tiers.map(tier => (
                        <motion.div
                            key={tier.id}
                            variants={fadeUp}
                            className={tier.featured ? 'tier-card-featured' : ''}
                            style={{
                                background: tier.featured ? 'var(--bg-card-hover)' : 'var(--bg-card)',
                                border: `1px solid ${tier.featured ? 'var(--gold-border)' : 'var(--border-subtle)'}`,
                                borderRadius: '16px',
                                overflow: 'hidden',
                                display: 'flex',
                                flexDirection: 'column',
                                position: 'relative',
                                boxShadow: tier.featured ? 'var(--shadow-gold)' : 'none',
                                zIndex: tier.featured ? 10 : 1,
                             }}
                        >
                            {/* Gold top line for featured */}
                            {tier.featured && (
                                <div style={{
                                    position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
                                    background: 'linear-gradient(90deg, transparent, var(--gold-mid), transparent)',
                                }} />
                            )}

                            {/* Header */}
                            <div style={{
                                padding: '32px 32px 24px',
                                borderBottom: `1px solid ${tier.featured ? 'var(--gold-border)' : 'var(--border-subtle)'}`,
                                textAlign: 'center',
                            }}>
                                <span style={{
                                    display: 'block',
                                    fontSize: '0.55rem', letterSpacing: '0.25em', textTransform: 'uppercase',
                                    color: 'var(--text-muted)', fontFamily: "'Inter', sans-serif", fontWeight: 700,
                                    marginBottom: '12px',
                                }}>
                                    {tier.tag}
                                </span>
                                <p style={{
                                    fontFamily: "'Cormorant Garamond', serif",
                                    fontSize: '2.8rem', fontWeight: 300, lineHeight: 1,
                                    color: tier.featured ? 'var(--gold-light)' : 'var(--text-primary)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                }}>
                                    {tier.name === 'Free' ? 'Free' : <PointsDisplay amount={tier.name} decimals={0} size={30} />}
                                </p>
                                {tier.featured && (
                                    <span style={{
                                        display: 'inline-block', marginTop: '12px',
                                        fontSize: '0.5rem', letterSpacing: '0.2em', textTransform: 'uppercase',
                                        color: 'var(--gold-mid)', border: '1px solid var(--gold-border)',
                                        padding: '3px 9px', borderRadius: '9999px',
                                        background: 'var(--gold-glow)',
                                        fontFamily: "'Inter', sans-serif", fontWeight: 700,
                                    }}>
                                        Most Popular
                                    </span>
                                )}
                            </div>

                            {/* Features */}
                            <ul style={{ padding: '24px 32px', flex: 1, listStyle: 'none', margin: 0 }}>
                                {tier.features.map(f => (
                                    <li key={f.label} style={{
                                        display: 'flex', alignItems: 'center', gap: '12px',
                                        marginBottom: '12px', fontSize: '0.82rem',
                                        fontFamily: "'Inter', sans-serif",
                                    }}>
                                        <span style={{
                                            flexShrink: 0,
                                            color: f.included
                                                ? (tier.featured ? 'var(--gold-mid)' : 'var(--green-status)')
                                                : 'var(--text-muted)',
                                        }}>
                                            {f.included ? <CheckIcon /> : <XIcon />}
                                        </span>
                                        <span style={{
                                            color: f.included ? 'var(--text-secondary)' : 'var(--text-muted)',
                                            textDecoration: f.included ? 'none' : 'line-through',
                                        }}>
                                            {f.label}
                                        </span>
                                    </li>
                                ))}
                            </ul>

                            {/* CTA */}
                            <div style={{ padding: '0 32px 32px' }}>
                                <a href="/signup" style={{
                                    display: 'block', width: '100%', textAlign: 'center',
                                    padding: '13px',
                                    fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase',
                                    fontWeight: 700, fontFamily: "'Inter', sans-serif",
                                    textDecoration: 'none',
                                    borderRadius: '2px',
                                    transition: 'all 0.2s',
                                    ...(tier.featured ? {
                                        background: 'linear-gradient(135deg, var(--gold-deep), var(--gold-mid), var(--gold-light))',
                                        color: '#000',
                                        border: '1px solid transparent',
                                        boxShadow: '0 4px 20px rgba(197, 168, 128, 0.2)',
                                    } : {
                                        background: 'transparent',
                                        color: 'var(--gold-mid)',
                                        border: '1px solid var(--gold-mid)',
                                    }),
                                }}
                                    onMouseEnter={e => {
                                        if (!tier.featured) {
                                            e.currentTarget.style.background = 'var(--gold-glow)';
                                        }
                                    }}
                                    onMouseLeave={e => {
                                        if (!tier.featured) {
                                            e.currentTarget.style.background = 'transparent';
                                        }
                                    }}
                                >
                                    {tier.cta}
                                </a>
                            </div>

                            {/* Bottom glow for featured */}
                            {tier.featured && (
                                <div style={{
                                    position: 'absolute', bottom: 0, left: '25%', right: '25%', height: '1px',
                                    background: 'linear-gradient(90deg, transparent, var(--gold-border), transparent)',
                                    filter: 'blur(2px)',
                                }} />
                            )}
                        </motion.div>
                    ))}
                </motion.div>

                {/* Footnote */}
                <motion.p
                    initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
                    viewport={{ once: true }} transition={{ delay: 0.4, duration: 0.6 }}
                    style={{
                        textAlign: 'center', marginTop: '40px',
                        color: 'var(--text-muted)', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase',
                        fontFamily: "'Inter', sans-serif",
                    }}
                >
                    All memberships are lifetime access · No recurring charges
                </motion.p>
            </div>
        </section>
    );
}
