import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { userApi, providerApi, type PartnerRequestStatus } from "../../../../utils/api";
import { useAuth } from "../../../../context/AuthContext";

/**
 * The profile details required by the View Profile modal. Both partner-search
 * results and featured-profile cards provide this subset of the user row.
 */
export interface ProfileDetailsInput {
    id: number;
    name: string;
    avatar_url: string | null;
    profession: string | null;
    location: string | null;
    interests?: string | null;
    date_of_birth?: string | null;
}

function toInterestsArray(value: string | null | undefined): string[] {
    if (!value) return [];
    return value.split(",").map((s) => s.trim()).filter(Boolean);
}

function computeAgeFromDob(dob: string | null | undefined): number | null {
    if (!dob) return null;
    const d = new Date(dob);
    if (Number.isNaN(d.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
    return age;
}

function Avatar({ name, avatar_url, size = 54 }: { name: string; avatar_url: string | null; size?: number }) {
    const initials = (name || "").trim().slice(0, 1).toUpperCase() || "M";
    return (
        <div
            style={{
                width: size,
                height: size,
                borderRadius: "50%",
                overflow: "hidden",
                border: "2px solid var(--border-subtle)",
                background: "linear-gradient(135deg, var(--blue-neon), var(--blue-vivid))",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 0 3px rgba(59,130,246,0.08)",
            }}
        >
            {avatar_url ? (
                <img src={avatar_url} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
                <span style={{ fontWeight: 800, color: "#fff", fontSize: size * 0.38 }}>{initials}</span>
            )}
        </div>
    );
}

function Pill({ children }: { children: React.ReactNode }) {
    return (
        <span
            style={{
                padding: "5px 11px",
                borderRadius: 999,
                border: "1px solid var(--border-subtle)",
                background: "var(--blue-glow)",
                color: "var(--blue-vivid)",
                fontWeight: 700,
                fontSize: "0.68rem",
                whiteSpace: "nowrap",
            }}
        >
            {children}
        </span>
    );
}

/**
 * Shared "View Profile" modal used by the partner/service-request flow and by
 * Featured Profiles. Role-aware: a user views a provider via
 * userApi.getPartnerProfile, a provider views a user via
 * providerApi.getRequesterProfile. Access (public vs full) is preserved.
 */
export function ProfileDetailsModal({
    open,
    profile,
    statusById,
    onRequest,
    onClose,
}: {
    open: boolean;
    profile: ProfileDetailsInput | null;
    statusById: Map<number, PartnerRequestStatus | null>;
    onRequest: (id: number) => void;
    onClose: () => void;
}) {
    const { user } = useAuth();
    const role = user?.role;
    const [gated, setGated] = useState<{ profile: any; access: 'public' | 'full' } | null>(null);
    const [loadingProfile, setLoadingProfile] = useState(false);

    const status = profile ? (statusById.get(profile.id) ?? null) : null;
    const canRequest = status === null || status === 'rejected' || status === 'cancelled';
    const isAccepted = status === 'accepted';

    useEffect(() => {
        if (!open || !profile) return;
        let cancelled = false;
        setLoadingProfile(true);
        setGated(null);
        const load = async () => {
            const res = role === 'provider'
                ? await providerApi.getRequesterProfile(profile.id)
                : await userApi.getPartnerProfile(profile.id);
            if (!cancelled && !res.error && res.data) {
                setGated({ profile: res.data.profile, access: res.data.access });
            }
            if (!cancelled) setLoadingProfile(false);
        };
        load();
        return () => { cancelled = true; };
    }, [open, profile, role]);

    if (!open || !profile) return null;

    const view = gated?.profile ?? profile;
    const fullAccess = gated?.access === 'full';
    const interests = view.interests ? toInterestsArray(view.interests) : [];
    const age = computeAgeFromDob(view.date_of_birth);

    const goToChat = () => {
        // Navigate into the chat tab; the conversation list will include the
        // provider once the request is accepted (chat is unlocked).
        window.location.href = `/${role}/dashboard/chat`;
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            style={{
                position: "fixed", inset: 0, background: "var(--bg-overlay)", backdropFilter: "blur(8px)",
                zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
            }}
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.2 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: "100%",
                    maxWidth: 520,
                    maxHeight: "88svh",
                    overflowY: "auto",
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "20px",
                    boxShadow: "var(--shadow-lg)",
                }}
            >
                {/* Header banner */}
                <div style={{
                    background: "linear-gradient(135deg, var(--blue-neon), var(--blue-vivid))",
                    padding: "22px 20px 18px",
                    position: "relative",
                }}>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            position: "absolute", top: 14, right: 14,
                            width: 30, height: 30, borderRadius: "50%",
                            background: "rgba(0,0,0,0.2)", border: "none",
                            color: "#fff", cursor: "pointer", fontSize: 14,
                            display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                    >
                        ✕
                    </button>
                    <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                        <Avatar name={view.name} avatar_url={view.avatar_url} size={64} />
                        <div>
                            <div style={{ color: "#fff", fontWeight: 900, fontSize: "1.2rem" }}>{view.name}</div>
                            <div style={{ color: "rgba(255,255,255,0.85)", fontWeight: 600, fontSize: "0.8rem", marginTop: 2 }}>
                                {view.profession || "Profession not set"}{age !== null ? ` · ${age} yrs` : ""}
                            </div>
                            {!fullAccess && (
                                <div style={{ color: "rgba(255,255,255,0.75)", fontWeight: 600, fontSize: "0.68rem", marginTop: 4 }}>
                                    Public profile · full access after request accepted
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div style={{ padding: 20 }}>
                    {loadingProfile ? (
                        <div style={{ color: "var(--text-muted)", fontWeight: 600, fontSize: "0.82rem", padding: "12px 0" }}>
                            Loading profile…
                        </div>
                    ) : (
                        <>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
                                {[
                                    { label: "Location", value: view.location ?? "Not set" },
                                    ...(fullAccess ? [
                                        { label: "Gender", value: view.gender ?? "Not set" },
                                        { label: "Education", value: view.education ?? "Not set" },
                                        { label: "Relationship goal", value: view.relationship_goal ?? "Not set" },
                                        { label: "Marital status", value: view.marital_status ?? "Not set" },
                                    ] : []),
                                ].map((row) => (
                                    <div key={row.label} style={{
                                        display: "flex", justifyContent: "space-between", gap: 10,
                                        padding: "11px 13px", borderRadius: 10,
                                        background: "var(--bg-input)", border: "1px solid var(--border-subtle)",
                                    }}>
                                        <span style={{ color: "var(--text-muted)", fontWeight: 700, fontSize: "0.78rem" }}>{row.label}</span>
                                        <span style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: "0.82rem", textAlign: "right", wordBreak: "break-word" }}>{row.value}</span>
                                    </div>
                                ))}
                            </div>

                            <div style={{ marginBottom: 22 }}>
                                <div style={{ color: "var(--text-muted)", fontWeight: 800, fontSize: "0.7rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                                    Interests
                                </div>
                                {interests.length ? (
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                                        {interests.map((i) => <Pill key={i}>{i}</Pill>)}
                                    </div>
                                ) : (
                                    <div style={{ color: "var(--text-secondary)", fontWeight: 600, fontSize: "0.8rem" }}>Not set</div>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={() => onRequest(profile.id)}
                                disabled={!canRequest}
                                style={{
                                    width: "100%",
                                    padding: "14px",
                                    background: canRequest ? "linear-gradient(135deg, var(--blue-neon), var(--blue-vivid))" : "rgba(59,130,246,0.15)",
                                    border: "none",
                                    borderRadius: 11,
                                    color: canRequest ? "#fff" : "var(--text-muted)",
                                    fontWeight: 800,
                                    fontSize: "0.85rem",
                                    cursor: canRequest ? "pointer" : "not-allowed",
                                    boxShadow: canRequest ? "0 0 18px rgba(59,130,246,0.35)" : "none",
                                }}
                            >
                                {status === 'pending' ? 'Pending Approval' : status === 'accepted' ? 'Connected' : status === 'rejected' ? 'Request Rejected' : 'Send Request'}
                            </button>

                            {isAccepted && (
                                <button
                                    type="button"
                                    onClick={goToChat}
                                    style={{
                                        width: "100%",
                                        marginTop: 10,
                                        padding: "14px",
                                        background: "linear-gradient(135deg,#22c55e,#16a34a)",
                                        border: "none",
                                        borderRadius: 11,
                                        color: "#fff",
                                        fontWeight: 800,
                                        fontSize: "0.85rem",
                                        cursor: "pointer",
                                        boxShadow: "0 0 18px rgba(34,197,94,0.35)",
                                    }}
                                >
                                    Open Chat
                                </button>
                            )}
                        </>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
