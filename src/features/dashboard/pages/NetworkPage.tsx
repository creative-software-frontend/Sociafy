import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TopNav } from "./TopNav";
import { useAuth } from "../../../context/AuthContext";

const fadeUp = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const container = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.1 } },
};

export function NetworkPage() {
    const { user } = useAuth();

    const [referralUrl, setReferralUrl] = useState<string>("");
    const [copied, setCopied] = useState(false);


    useEffect(() => {
        if (!user?.id) return;

        // Strictly S/P referral code: S|P + userId + 6-char suffix
        const prefix = user.role === "provider" ? "P" : "S";
        const suffix = Math.random().toString(36).substring(2, 8).toUpperCase();
        const referralCode = `${prefix}${user.id}${suffix}`;

        setReferralUrl(`https://sociafy-eta.vercel.app/login.php?ref=${referralCode}`);
    }, [user?.id, user?.role]);

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(referralUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy link: ", err);
        }
    };

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={container}
            style={{ minHeight: '100svh', background: 'var(--bg-main)', width: '100%', overflowX: 'hidden' }}
        >
            <TopNav />

            {/* Fluid top padding so content clears the fixed TopNav on all screens */}
            <div style={{
                width: '100%',
                padding: 'clamp(90px, 22vw, 108px) clamp(12px, 4vw, 16px) clamp(32px, 8vw, 48px)',
                boxSizing: 'border-box',
            }}>

                {/* ── Stats grid: 2-col, fluid card padding ── */}
                <motion.div
                    variants={fadeUp}
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: 'clamp(10px, 3vw, 20px)',
                        marginBottom: 'clamp(20px, 5vw, 32px)',
                    }}
                >
                    {[
                        {
                            title: "REFERRALS",
                            value: "0",
                            icon: (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--blue-vivid)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                </svg>
                            )
                        },
                        {
                            title: "CONVERSIONS",
                            value: "0",
                            icon: (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                </svg>
                            )
                        },
                        {
                            title: "COMMISSION",
                            value: "0%",
                            icon: (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--blue-vivid)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="19" y1="5" x2="5" y2="19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" />
                                </svg>
                            )
                        }
                    ].map((stat, idx) => (
                        <div key={idx} style={{
                            background: 'linear-gradient(135deg, var(--bg-card-hover) 0%, var(--bg-card) 100%)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '14px',
                            padding: 'clamp(16px, 4.5vw, 24px) clamp(12px, 3.5vw, 20px)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 'clamp(6px, 2vw, 10px)',
                            boxShadow: 'var(--shadow-md)',
                            textAlign: 'center',
                            boxSizing: 'border-box',
                        }}>
                            <div style={{ opacity: 0.85 }}>{stat.icon}</div>
                            <span style={{
                                fontSize: 'clamp(0.55rem, 2vw, 0.65rem)',
                                letterSpacing: '0.15em',
                                fontWeight: 700,
                                color: 'var(--text-muted)',
                                textTransform: 'uppercase',
                            }}>
                                {stat.title}
                            </span>
                            <span style={{
                                fontSize: 'clamp(1.15rem, 5vw, 1.45rem)',
                                fontWeight: 700,
                                color: 'var(--blue-vivid)',
                                fontFamily: "'Inter', sans-serif",
                                textShadow: '0 0 16px rgba(59,130,246,0.25)',
                            }}>
                                {stat.value}
                            </span>
                        </div>
                    ))}
                </motion.div>


                {/* ── Referral link panel ── */}
                <motion.div variants={fadeUp} style={{
                    background: 'linear-gradient(180deg, var(--bg-card-hover) 0%, var(--bg-card) 100%)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '16px',
                    padding: 'clamp(20px, 5.5vw, 32px)',
                    boxShadow: 'var(--shadow-lg)',
                }}>

                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 'clamp(14px, 4vw, 20px)' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--blue-vivid)" strokeWidth="2" style={{ flexShrink: 0 }}>
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                        </svg>
                        <h3 style={{
                            fontSize: 'clamp(0.88rem, 4vw, 1.05rem)',
                            fontWeight: 500,
                            color: 'var(--blue-vivid)',
                            fontFamily: "'Inter', sans-serif",
                            letterSpacing: '0.02em',
                        }}>
                            Your Referral Network Link
                        </h3>
                    </div>

                    {/* URL row — wraps on very small screens */}
                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        background: 'var(--bg-root)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '10px',
                        padding: 'clamp(8px, 2.5vw, 12px) clamp(10px, 3vw, 18px)',
                        alignItems: 'center',
                        gap: 'clamp(8px, 2.5vw, 16px)',
                        marginBottom: 'clamp(20px, 6vw, 32px)',
                        boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.5)',
                    }}>
                        <span style={{
                            color: 'var(--text-primary)',
                            fontSize: 'clamp(0.7rem, 2.8vw, 0.85rem)',
                            fontWeight: 500,
                            fontFamily: "system-ui, -apple-system, sans-serif",
                            letterSpacing: '0.01em',
                            overflowX: 'auto',
                            whiteSpace: 'nowrap',
                            flex: '1 1 0',
                            minWidth: 0,
                            scrollbarWidth: 'none',
                        }}>
                            {referralUrl}
                        </span>
                        <button
                            onClick={handleCopyLink}
                            style={{
                                flexShrink: 0,
                                background: copied
                                    ? 'var(--green-status)'
                                    : 'linear-gradient(135deg, var(--blue-neon), var(--blue-vivid))',
                                border: 'none',
                                borderRadius: '8px',
                                color: '#ffffff',
                                padding: 'clamp(9px, 2.5vw, 12px) clamp(14px, 4vw, 24px)',
                                fontSize: 'clamp(0.65rem, 2.5vw, 0.75rem)',
                                fontWeight: 800,
                                letterSpacing: '0.06em',
                                textTransform: 'uppercase',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                                boxShadow: copied
                                    ? '0 4px 12px rgba(16,185,129,0.3)'
                                    : '0 4px 12px rgba(59,130,246,0.3)',
                            }}
                        >
                            {copied ? "COPIED!" : "COPY LINK"}
                        </button>
                    </div>

                    {/* Divider */}
                    <div style={{ height: '1px', background: 'var(--border-subtle)', width: '100%', marginBottom: 'clamp(16px, 4vw, 24px)' }} />

                    {/* Reward structure */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'clamp(12px, 4vw, 20px)' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ flexShrink: 0 }}>
                                <path d="M20 12V8H4v4M2 4h20v4H2zM4 12h16v8H4zM12 12v8" />
                            </svg>
                            <span style={{
                                fontSize: 'clamp(0.6rem, 2.2vw, 0.7rem)',
                                letterSpacing: '0.15em',
                                textTransform: 'uppercase',
                                color: 'var(--text-muted)',
                                fontWeight: 700,
                            }}>
                                REWARD STRUCTURE
                            </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(12px, 3.5vw, 16px)' }}>
                            {[
                                { level: "1 Referral Purchase:",   text: "Regular Tier + 1,000 Bonus",          color: 'var(--green-status)', symbol: "★" },
                                { level: "2 Referral Purchases:",  text: "Premium Tier + Extra 1,000 Bonus",    color: 'var(--gold-mid)',     symbol: "👑" },
                                { level: "5 Referral Purchases:",  text: "Elite Tier + 5,000 Bonus",            color: 'var(--blue-vivid)',   symbol: "💎" },
                                { level: "Lifetime Benefits:",     text: "Unlocked networks are permanent.",      color: 'var(--blue-vivid)',   symbol: "∞"  },
                            ].map((reward, i) => (
                                <div key={i} style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: 'clamp(10px, 3vw, 14px)',
                                    fontSize: 'clamp(0.78rem, 3.2vw, 0.85rem)',
                                }}>
                                    <span style={{ color: reward.color, fontSize: '1rem', width: '20px', textAlign: 'center', flexShrink: 0, lineHeight: 1.4 }}>
                                        {reward.symbol}
                                    </span>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', minWidth: 0 }}>
                                        <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{reward.level}</span>
                                        <span style={{ color: 'var(--text-secondary)' }}>{reward.text}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </motion.div>
            </div>
        </motion.div>
    );
}