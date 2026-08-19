import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { providerApi, type PartnerRequestItem, type PartnerRequestStatus } from "../../../../utils/api";
import { useToast } from "../../../../components/Toast";

const fadeUp = {
    hidden: { opacity: 0, y: 14 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.45 } },
};

const container = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.06 } },
};

function toInterestsArray(value: string | null): string[] {
    if (!value) return [];
    return value.split(",").map((s) => s.trim()).filter(Boolean);
}

function computeAgeFromDob(dob: string | null): number | null {
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
                border: "2px solid var(--gold-border)",
                background: "linear-gradient(135deg, var(--gold-rich), var(--gold-deep))",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 0 3px rgba(197,168,128,0.1)",
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
                border: "1px solid var(--gold-border)",
                background: "rgba(197,168,128,0.1)",
                color: "var(--gold-mid)",
                fontWeight: 700,
                fontSize: "0.68rem",
                whiteSpace: "nowrap",
            }}
        >
            {children}
        </span>
    );
}

function StatusBadge({ status }: { status: PartnerRequestStatus }) {
    const map: Record<PartnerRequestStatus, { label: string; color: string; bg: string }> = {
        pending: { label: "Pending", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
        accepted: { label: "Accepted", color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
        rejected: { label: "Rejected", color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
        cancelled: { label: "Cancelled", color: "#94a3b8", bg: "rgba(148,163,184,0.12)" },
    };
    const s = map[status];
    return (
        <span style={{
            padding: "4px 10px",
            borderRadius: 999,
            background: s.bg,
            color: s.color,
            fontWeight: 800,
            fontSize: "0.66rem",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
        }}>
            {s.label}
        </span>
    );
}

function RequestCard({
    item,
    onAccept,
    onReject,
    onViewProfile,
    busy,
}: {
    item: PartnerRequestItem;
    onAccept: (id: number) => void;
    onReject: (id: number) => void;
    onViewProfile: (id: number) => void;
    busy: boolean;
}) {
    const age = computeAgeFromDob(item.date_of_birth);
    const interests = item.interests ? toInterestsArray(item.interests) : [];
    const isPending = item.status === "pending";

    return (
        <motion.div
            variants={fadeUp}
            style={{
                background: "linear-gradient(135deg, var(--bg-card-hover) 0%, var(--bg-card) 100%)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 16,
                padding: 16,
                boxShadow: "var(--shadow-sm)",
                position: "relative",
                overflow: "hidden",
            }}
        >
            <div style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: 1, background: "linear-gradient(90deg, transparent, var(--gold-rich), transparent)", opacity: 0.5 }} />

            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <Avatar name={item.name ?? "User"} avatar_url={item.avatar_url} />
                <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: "1rem" }}>{item.name ?? "Unknown"}</div>
                        {age !== null && (
                            <span style={{ color: "var(--gold-mid)", fontWeight: 700, fontSize: "0.7rem", letterSpacing: "0.04em" }}>
                                {age} yrs
                            </span>
                        )}
                        <StatusBadge status={item.status} />
                    </div>
                    <div style={{ color: "var(--text-secondary)", fontWeight: 500, fontSize: "0.78rem", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {item.profession || "Profession not set"}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-muted)", fontSize: "0.72rem", marginTop: 3 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                        {item.location || "Location not set"}
                    </div>
                </div>
            </div>

            {interests.length > 0 && (
                <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {interests.slice(0, 3).map((x) => <Pill key={x}>{x}</Pill>)}
                    {interests.length > 3 && (
                        <span style={{ color: "var(--text-muted)", fontWeight: 700, fontSize: "0.7rem", alignSelf: "center" }}>+{interests.length - 3}</span>
                    )}
                </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button
                    type="button"
                    onClick={() => onViewProfile(item.user_id)}
                    style={{
                        flex: 1,
                        padding: "10px",
                        background: "transparent",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: 9,
                        color: "var(--text-secondary)",
                        fontWeight: 700,
                        fontSize: "0.76rem",
                        cursor: "pointer",
                    }}
                >
                    View Profile
                </button>
                {isPending && (
                    <>
                        <button
                            type="button"
                            onClick={() => onAccept(item.id)}
                            disabled={busy}
                            style={{
                                flex: 1,
                                padding: "10px",
                                background: "linear-gradient(135deg,#22c55e,#16a34a)",
                                border: "none",
                                borderRadius: 9,
                                color: "#fff",
                                fontWeight: 800,
                                fontSize: "0.76rem",
                                cursor: busy ? "not-allowed" : "pointer",
                                opacity: busy ? 0.6 : 1,
                                boxShadow: "0 0 14px rgba(34,197,94,0.3)",
                            }}
                        >
                            Accept
                        </button>
                        <button
                            type="button"
                            onClick={() => onReject(item.id)}
                            disabled={busy}
                            style={{
                                flex: 1,
                                padding: "10px",
                                background: "rgba(239,68,68,0.15)",
                                border: "1px solid rgba(239,68,68,0.4)",
                                borderRadius: 9,
                                color: "#f87171",
                                fontWeight: 800,
                                fontSize: "0.76rem",
                                cursor: busy ? "not-allowed" : "pointer",
                                opacity: busy ? 0.6 : 1,
                            }}
                        >
                            Reject
                        </button>
                    </>
                )}
            </div>
        </motion.div>
    );
}

function RequesterDetailsModal({
    open,
    userId,
    status,
    onClose,
}: {
    open: boolean;
    userId: number | null;
    status: PartnerRequestStatus | null;
    onClose: () => void;
}) {
    const [gated, setGated] = useState<{ profile: any; access: 'public' | 'full' } | null>(null);
    const [loadingProfile, setLoadingProfile] = useState(false);

    const isAccepted = status === 'accepted';

    useEffect(() => {
        if (!open || !userId) return;
        let cancelled = false;
        setLoadingProfile(true);
        setGated(null);
        const load = async () => {
            const res = await providerApi.getRequesterProfile(userId);
            if (!cancelled && !res.error && res.data) {
                setGated({ profile: res.data.profile, access: res.data.access });
            }
            if (!cancelled) setLoadingProfile(false);
        };
        load();
        return () => { cancelled = true; };
    }, [open, userId]);

    if (!open || !userId) return null;

    const view = gated?.profile;
    if (!view && !loadingProfile) return null;

    const fullAccess = gated?.access === 'full';
    const interests = view?.interests ? toInterestsArray(view.interests) : [];
    const age = computeAgeFromDob(view?.date_of_birth ?? null);

    const goToChat = () => {
        window.location.href = `/provider/dashboard/chat?partner=${userId}`;
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
                    background: "linear-gradient(135deg, var(--gold-rich), var(--gold-deep))",
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
                        <Avatar name={view?.name ?? "User"} avatar_url={view?.avatar_url ?? null} size={64} />
                        <div>
                            <div style={{ color: "#fff", fontWeight: 900, fontSize: "1.2rem" }}>{view?.name ?? "Loading..."}</div>
                            {view && (
                                <div style={{ color: "rgba(255,255,255,0.85)", fontWeight: 600, fontSize: "0.8rem", marginTop: 2 }}>
                                    {view.profession || "Profession not set"}{age !== null ? ` · ${age} yrs` : ""}
                                </div>
                            )}
                            {!fullAccess && view && (
                                <div style={{ color: "rgba(255,255,255,0.75)", fontWeight: 600, fontSize: "0.68rem", marginTop: 4 }}>
                                    Public profile · full access after request accepted
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div style={{ padding: 20 }}>
                    {loadingProfile || !view ? (
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

                            {isAccepted && (
                                <button
                                    type="button"
                                    onClick={goToChat}
                                    style={{
                                        width: "100%",
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

export function PartnerRequestsPanel() {
    const toast = useToast();
    const [requests, setRequests] = useState<PartnerRequestItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [viewProfileId, setViewProfileId] = useState<number | null>(null);

    const load = async () => {
        setLoading(true);
        setError(null);
        const res = await providerApi.getPartnerRequests();
        if (res.error) {
            setError(res.error);
            setRequests([]);
        } else {
            setRequests(res.data?.requests ?? []);
        }
        setLoading(false);
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const pendingCount = useMemo(() => requests.filter((r) => r.status === "pending").length, [requests]);

    const handleAccept = async (id: number) => {
        setBusyId(id);
        const res = await providerApi.acceptPartnerRequest(id);
        setBusyId(null);
        if (res.error) {
            toast.error(res.error);
            return;
        }
        toast.success("Request accepted — chat & full profile unlocked");
        setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: "accepted" } : r)));
    };

    const handleReject = async (id: number) => {
        setBusyId(id);
        const res = await providerApi.rejectPartnerRequest(id);
        setBusyId(null);
        if (res.error) {
            toast.error(res.error);
            return;
        }
        toast.info("Request rejected");
        setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: "rejected" } : r)));
    };

    const handleViewProfile = (userId: number) => {
        setViewProfileId(userId);
    };

    return (
        <motion.div initial="hidden" animate="visible" variants={container} style={{ width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ color: "var(--text-secondary)", fontWeight: 700, fontSize: "0.8rem" }}>
                    <span style={{ color: "var(--text-primary)", fontWeight: 900 }}>{pendingCount}</span> pending request{pendingCount === 1 ? "" : "s"}
                </div>
                <button
                    type="button"
                    onClick={load}
                    disabled={loading}
                    style={{
                        padding: "8px 14px", borderRadius: 9,
                        border: "1px solid var(--border-subtle)", background: "transparent",
                        color: "var(--text-secondary)", fontWeight: 700, fontSize: "0.76rem",
                        cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1,
                    }}
                >
                    {loading ? "Refreshing…" : "Refresh"}
                </button>
            </div>

            {error && (
                <motion.div variants={fadeUp} style={{
                    padding: "12px 14px", borderRadius: 10,
                    border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)",
                    color: "var(--red-status)", fontWeight: 700, fontSize: "0.82rem",
                }}>
                    ⚠ {error}
                </motion.div>
            )}

            {loading ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginTop: 14 }}>
                    {[0, 1, 2].map((i) => (
                        <div key={i} style={{
                            background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
                            borderRadius: 16, padding: 16, display: "flex", gap: 12, alignItems: "center",
                        }}>
                            <div style={{ width: 54, height: 54, borderRadius: "50%", background: "var(--bg-input)", animation: "pulse 1.4s ease-in-out infinite" }} />
                            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                                <div style={{ width: "50%", height: 12, borderRadius: 6, background: "var(--bg-input)", animation: "pulse 1.4s ease-in-out infinite" }} />
                                <div style={{ width: "70%", height: 10, borderRadius: 6, background: "var(--bg-input)", animation: "pulse 1.4s ease-in-out infinite" }} />
                            </div>
                        </div>
                    ))}
                    <style>{`@keyframes pulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }`}</style>
                </div>
            ) : requests.length === 0 ? (
                <motion.div variants={fadeUp} style={{
                    marginTop: 14, textAlign: "center", padding: "48px 20px",
                    background: "var(--bg-card)", border: "1px dashed var(--border-subtle)",
                    borderRadius: 16,
                }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 14px" }}>
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    <p style={{ color: "var(--text-secondary)", fontWeight: 700, fontSize: "0.88rem", marginBottom: 4 }}>No partner requests yet</p>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>When users send you partner requests, they'll appear here.</p>
                </motion.div>
            ) : (
                <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
                    {requests.map((r) => (
                        <RequestCard
                            key={r.id}
                            item={r}
                            onAccept={handleAccept}
                            onReject={handleReject}
                            onViewProfile={handleViewProfile}
                            busy={busyId === r.id}
                        />
                    ))}
                </div>
            )}
            
            <RequesterDetailsModal 
                open={viewProfileId !== null} 
                userId={viewProfileId}
                status={requests.find(r => r.user_id === viewProfileId)?.status ?? null}
                onClose={() => setViewProfileId(null)}
            />
        </motion.div>
    );
}

export default PartnerRequestsPanel;
