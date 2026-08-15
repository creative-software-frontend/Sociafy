import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { userApi, type PartnerSearchFilters, type PartnerSearchResponse, type UserProfile, type PartnerRequestStatus } from "../../../../utils/api";
import { FeatureGate } from "../../../../components/FeatureGate";
import { ProfileDetailsModal } from "./ProfileDetailsModal";

const fadeUp = {
    hidden: { opacity: 0, y: 14 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.45 } },
};

const container = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.06 } },
};

function toInterestsArray(value: string): string[] {
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

function countActiveFilters(filters: PartnerSearchFilters): number {
    let n = 0;
    if (filters.keyword) n++;
    if (filters.gender) n++;
    if (filters.ageMin !== undefined) n++;
    if (filters.ageMax !== undefined) n++;
    if (filters.location) n++;
    if (filters.profession) n++;
    if (filters.education) n++;
    if (filters.relationship_goal) n++;
    if (filters.marital_status) n++;
    if (filters.interests && filters.interests.length) n++;
    return n;
}

const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "11px 13px",
    background: "var(--bg-input)",
    border: "1px solid var(--border-default)",
    borderRadius: 9,
    color: "var(--text-primary)",
    fontSize: "0.83rem",
    fontFamily: "'Inter', sans-serif",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
};

const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.6rem",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    fontWeight: 800,
    color: "var(--text-muted)",
    marginBottom: 6,
};

function Avatar({ profile, size = 54 }: { profile: Pick<UserProfile, "name" | "avatar_url">; size?: number }) {
    const initials = (profile.name || "").trim().slice(0, 1).toUpperCase() || "M";
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
            {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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

function ProfileCard({
    profile,
    statusById,
    onRequest,
    onOpenDetails,
}: {
    profile: PartnerSearchResponse["results"][number];
    statusById: Map<number, PartnerRequestStatus | null>;
    onRequest: (receiverId: number) => void;
    onOpenDetails: (p: PartnerSearchResponse["results"][number]) => void;
}) {
    const age = computeAgeFromDob(profile.date_of_birth);
    const interests = profile.interests ? toInterestsArray(profile.interests) : [];
    const status = statusById.get(profile.id) ?? null;
    const canRequest = status === null || status === 'rejected' || status === 'cancelled';

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
                cursor: "pointer",
                transition: "transform 0.15s, border-color 0.15s",
            }}
            onClick={() => onOpenDetails(profile)}
            whileHover={{ y: -2 }}
        >
            <div style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: 1, background: "linear-gradient(90deg, transparent, var(--blue-vivid), transparent)", opacity: 0.5 }} />

            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <Avatar profile={{ name: profile.name, avatar_url: profile.avatar_url }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: "1rem" }}>{profile.name}</div>
                        {age !== null && (
                            <span style={{ color: "var(--gold-mid)", fontWeight: 700, fontSize: "0.7rem", letterSpacing: "0.04em" }}>
                                {age} yrs
                            </span>
                        )}
                    </div>
                    <div style={{ color: "var(--text-secondary)", fontWeight: 500, fontSize: "0.78rem", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {profile.profession || "Profession not set"}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-muted)", fontSize: "0.72rem", marginTop: 3 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                        {profile.location || "Location not set"}
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

            <div style={{ display: "flex", gap: 8, marginTop: 14 }} onClick={(e) => e.stopPropagation()}>
                <button
                    type="button"
                    onClick={() => onOpenDetails(profile)}
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
                <button
                    type="button"
                    onClick={() => onRequest(profile.id)}
                    disabled={!canRequest}
                    style={{
                        flex: 1,
                        padding: "10px",
                        background: canRequest ? "linear-gradient(135deg, var(--blue-neon), var(--blue-vivid))" : "rgba(59,130,246,0.15)",
                        border: "none",
                        borderRadius: 9,
                        color: canRequest ? "#fff" : "var(--text-muted)",
                        fontWeight: 800,
                        fontSize: "0.76rem",
                        cursor: canRequest ? "pointer" : "not-allowed",
                        boxShadow: canRequest ? "0 0 14px rgba(59,130,246,0.3)" : "none",
                    }}
                >
                    {status === 'pending' ? 'Pending Approval' : status === 'accepted' ? 'Connected' : status === 'rejected' ? 'Request Rejected' : 'Send Request'}
                </button>
            </div>
        </motion.div>
    );
}

function SearchFilters({
    filters,
    onChange,
    onReset,
    interestsOptions,
    open,
    setOpen,
}: {
    filters: PartnerSearchFilters;
    onChange: (next: PartnerSearchFilters) => void;
    onReset: () => void;
    interestsOptions: string[];
    open: boolean;
    setOpen: (v: boolean) => void;
}) {
    const set = <K extends keyof PartnerSearchFilters>(key: K, value: PartnerSearchFilters[K]) => {
        onChange({ ...filters, [key]: value });
    };
    const activeCount = countActiveFilters(filters);

    return (
        <div style={{
            background: "linear-gradient(135deg, var(--bg-card-hover) 0%, var(--bg-card) 100%)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 16,
            boxShadow: "var(--shadow-sm)",
            overflow: "hidden",
        }}>
            {/* Header / toggle */}
            <button
                type="button"
                onClick={() => setOpen(!open)}
                style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 16px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--blue-vivid)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="4" y1="6" x2="20" y2="6" /><circle cx="9" cy="6" r="2" fill="var(--bg-card)" />
                        <line x1="4" y1="12" x2="20" y2="12" /><circle cx="15" cy="12" r="2" fill="var(--bg-card)" />
                        <line x1="4" y1="18" x2="20" y2="18" /><circle cx="11" cy="18" r="2" fill="var(--bg-card)" />
                    </svg>
                    <span style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: "0.88rem" }}>Search Filters</span>
                    {activeCount > 0 && (
                        <span style={{
                            background: "var(--blue-vivid)", color: "#fff", borderRadius: 999,
                            fontSize: "0.65rem", fontWeight: 800, padding: "2px 8px",
                        }}>
                            {activeCount}
                        </span>
                    )}
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </button>

            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        style={{ overflow: "hidden" }}
                    >
                        <div style={{ padding: "0 16px 16px", borderTop: "1px solid var(--border-subtle)", paddingTop: 14 }}>
                            <div style={{ marginBottom: 12 }}>
                                <label style={labelStyle}>Keyword</label>
                                <input
                                    value={filters.keyword ?? ""}
                                    onChange={(e) => set("keyword", e.target.value || undefined)}
                                    style={fieldStyle}
                                    placeholder="Name, profession, education…"
                                />
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                                <div>
                                    <label style={labelStyle}>Gender</label>
                                    <select value={filters.gender ?? ""} onChange={(e) => set("gender", e.target.value || undefined)} style={{ ...fieldStyle, cursor: "pointer" }}>
                                        <option value="">Any</option>
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                        <option value="other">Other</option>
                                        <option value="prefer_not_to_say">Prefer not to say</option>
                                    </select>
                                </div>
                            </div>

                            <FeatureGate feature="ADVANCED_SEARCH" fullPage requiredTier="Gold">
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                                <div>
                                    <label style={labelStyle}>Location</label>
                                    <input value={filters.location ?? ""} onChange={(e) => set("location", e.target.value || undefined)} style={fieldStyle} placeholder="City / area" />
                                </div>
                                <div>
                                    <label style={labelStyle}>Min age</label>
                                    <input type="number" min={18} value={filters.ageMin ?? ""} onChange={(e) => set("ageMin", e.target.value ? Number(e.target.value) : undefined)} style={fieldStyle} placeholder="18" />
                                </div>
                                <div>
                                    <label style={labelStyle}>Max age</label>
                                    <input type="number" min={18} value={filters.ageMax ?? ""} onChange={(e) => set("ageMax", e.target.value ? Number(e.target.value) : undefined)} style={fieldStyle} placeholder="35" />
                                </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                                <div>
                                    <label style={labelStyle}>Profession</label>
                                   <select
    value={filters.profession ?? ""}
    onChange={(e) => set("profession", e.target.value || undefined)}
    style={{ ...fieldStyle, cursor: "pointer" }}
>
    <option value="">Any Profession</option>
    <option value="Student">Student</option>
    <option value="Engineer">Engineer</option>
    <option value="Doctor">Doctor</option>
    <option value="Teacher">Teacher</option>
    <option value="Lawyer">Lawyer</option>
    <option value="Business">Business</option>
    <option value="Government Job">Government Job</option>
    <option value="Private Job">Private Job</option>
    <option value="Freelancer">Freelancer</option>
    <option value="Entrepreneur">Entrepreneur</option>
    <option value="Other">Other</option>
</select>
                                </div>
                                <div>
                                    <label style={labelStyle}>Education</label>
                                    <select
    value={filters.education ?? ""}
    onChange={(e) => set("education", e.target.value || undefined)}
    style={{ ...fieldStyle, cursor: "pointer" }}
>
    <option value="">Any Education</option>
    <option value="SSC">SSC</option>
    <option value="HSC">HSC</option>
    <option value="Diploma">Diploma</option>
    <option value="Bachelor">Bachelor</option>
    <option value="Master">Master</option>
    <option value="PhD">PhD</option>
</select>
                                </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                                <div>
                                    <label style={labelStyle}>Relationship goal</label>
                                    <select
    value={filters.relationship_goal ?? ""}
    onChange={(e) => set("relationship_goal", e.target.value || undefined)}
    style={{ ...fieldStyle, cursor: "pointer" }}
>
    <option value="">Any Goal</option>
    <option value="Marriage">Marriage</option>
    <option value="Serious Relationship">Serious Relationship</option>
    <option value="Friendship">Friendship</option>
</select>
                                </div>
                                <div>
                                    <label style={labelStyle}>Marital status</label>
                                   <select
    value={filters.marital_status ?? ""}
    onChange={(e) => set("marital_status", e.target.value || undefined)}
    style={{ ...fieldStyle, cursor: "pointer" }}
>
    <option value="">Any Status</option>
    <option value="Single">Single</option>
    <option value="Divorced">Divorced</option>
    <option value="Widowed">Widowed</option>
    <option value="Separated">Separated</option>
</select>
                                </div>
                            </div>

                            <div style={{ marginBottom: 6 }}>
                                <label style={labelStyle}>Interests</label>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                                    {interestsOptions.map((i) => {
                                        const active = (filters.interests ?? []).includes(i);
                                        return (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={() => {
                                                    const cur = filters.interests ?? [];
                                                    const next = active ? cur.filter((x) => x !== i) : [...cur, i];
                                                    set("interests", next.length ? next : undefined);
                                                }}
                                                style={{
                                                    padding: "6px 12px",
                                                    borderRadius: 999,
                                                    border: `1px solid ${active ? "var(--blue-vivid)" : "var(--border-subtle)"}`,
                                                    background: active ? "var(--blue-glow)" : "transparent",
                                                    color: active ? "var(--blue-vivid)" : "var(--text-muted)",
                                                    fontWeight: 700,
                                                    fontSize: "0.7rem",
                                                    cursor: "pointer",
                                                    transition: "all 0.15s",
                                                }}
                                            >
                                                {i}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            </FeatureGate>

                            {activeCount > 0 && (
                                <button
                                    type="button"
                                    onClick={onReset}
                                    style={{
                                        marginTop: 10,
                                        width: "100%",
                                        padding: "10px",
                                        background: "transparent",
                                        border: "1px dashed var(--border-default)",
                                        borderRadius: 9,
                                        color: "var(--text-muted)",
                                        fontWeight: 700,
                                        fontSize: "0.75rem",
                                        cursor: "pointer",
                                    }}
                                >
                                    Clear all filters
                                </button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function ResultsSkeleton() {
    return (
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
    );
}

export function PartnerSearchPanel() {
    const interestsOptions = useMemo(() => [
        "Traveling", "Music", "Movies", "Reading", "Gaming", "Photography", "Cooking",
        "Fitness", "Gym", "Football", "Cricket", "Badminton", "Swimming", "Hiking",
        "Cycling", "Dancing", "Singing", "Art", "Fashion", "Technology", "Programming",
        "Business", "Entrepreneurship", "Pets", "Food", "Coffee", "Nature", "Volunteering", "Writing",
    ], []);

    const [filters, setFilters] = useState<PartnerSearchFilters>({
        keyword: "", gender: undefined, ageMin: undefined, ageMax: undefined,
        profession: undefined, education: undefined, location: undefined,
        relationship_goal: undefined, marital_status: undefined, interests: undefined,
    });
    const [filtersOpen, setFiltersOpen] = useState(false);

    const [page, setPage] = useState(1);
    const pageSize = 12;

    const [data, setData] = useState<PartnerSearchResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [statusById, setStatusById] = useState<Map<number, PartnerRequestStatus | null>>(new Map());
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [detailsProfile, setDetailsProfile] = useState<PartnerSearchResponse["results"][number] | null>(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError(null);
            const searchRes = await userApi.searchPartners({ ...filters, page, pageSize });
            if (cancelled) return;
            if (searchRes.error) {
                setError(searchRes.error);
                setData(null);
                setLoading(false);
                return;
            }
            setData(searchRes.data ?? null);
            setLoading(false);
        };
        load();
        return () => { cancelled = true; };
    }, [filters, page]);

    // Load partner-request status for each provider in the current results.
    useEffect(() => {
        let cancelled = false;
        const results = data?.results ?? [];
        if (results.length === 0) return;
        const loadStatuses = async () => {
            const next = new Map<number, PartnerRequestStatus | null>();
            await Promise.all(
                results.map(async (p) => {
                    const res = await userApi.getPartnerRequestStatus(p.id);
                    if (!cancelled && !res.error) next.set(p.id, res.data?.status ?? null);
                })
            );
            if (!cancelled) setStatusById(next);
        };
        loadStatuses();
        return () => { cancelled = true; };
    }, [data]);

    const onRequest = async (providerId: number) => {
        const res = await userApi.sendPartnerRequest(providerId);
        if (res.error) {
            setError(res.error);
            return;
        }
        // Optimistically reflect the new pending status.
        setStatusById((prev) => {
            const next = new Map(prev);
            next.set(providerId, res.data?.status ?? 'pending');
            return next;
        });
    };

    const openDetails = (p: PartnerSearchResponse["results"][number]) => {
        setDetailsProfile(p);
        setDetailsOpen(true);
    };

    const resetFilters = () => {
        setPage(1);
        setFilters({
            keyword: "", gender: undefined, ageMin: undefined, ageMax: undefined,
            profession: undefined, education: undefined, location: undefined,
            relationship_goal: undefined, marital_status: undefined, interests: undefined,
        });
    };

    const results = data?.results ?? [];

    return (
        <FeatureGate feature="PARTNER_SEARCH" fullPage requiredTier="Silver">
        <motion.div initial="hidden" animate="visible" variants={container} style={{ width: "100%" }}>
            <SearchFilters
                filters={filters}
                onChange={(next) => { setPage(1); setFilters(next); }}
                onReset={resetFilters}
                interestsOptions={interestsOptions}
                open={filtersOpen}
                setOpen={setFiltersOpen}
            />

            <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div style={{ color: "var(--text-secondary)", fontWeight: 700, fontSize: "0.8rem" }}>
                    {loading ? "Searching…" : (
                        <>
                            <span style={{ color: "var(--text-primary)", fontWeight: 900 }}>{data?.total ?? 0}</span> profiles found
                        </>
                    )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                    <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1 || loading}
                        style={{
                            padding: "8px 14px", borderRadius: 9,
                            border: "1px solid var(--border-subtle)", background: "transparent",
                            color: "var(--text-secondary)", fontWeight: 700, fontSize: "0.78rem",
                            cursor: page <= 1 || loading ? "not-allowed" : "pointer",
                            opacity: page <= 1 ? 0.5 : 1,
                        }}
                    >
                        ← Prev
                    </button>
                    <button
                        type="button"
                        onClick={() => setPage((p) => p + 1)}
                        disabled={loading || !data || results.length < pageSize}
                        style={{
                            padding: "8px 14px", borderRadius: 9, border: "none",
                            background: "linear-gradient(135deg, var(--blue-neon), var(--blue-vivid))",
                            color: "#fff", fontWeight: 700, fontSize: "0.78rem",
                            cursor: loading || !data || results.length < pageSize ? "not-allowed" : "pointer",
                            opacity: !data || results.length < pageSize ? 0.5 : 1,
                        }}
                    >
                        Next →
                    </button>
                </div>
            </div>

            {error && (
                <motion.div variants={fadeUp} style={{
                    marginTop: 14, padding: "12px 14px", borderRadius: 10,
                    border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)",
                    color: "var(--red-status)", fontWeight: 700, fontSize: "0.82rem",
                }}>
                    ⚠ {error}
                </motion.div>
            )}

            {loading ? (
                <ResultsSkeleton />
            ) : results.length === 0 ? (
                <motion.div variants={fadeUp} style={{
                    marginTop: 14, textAlign: "center", padding: "48px 20px",
                    background: "var(--bg-card)", border: "1px dashed var(--border-subtle)",
                    borderRadius: 16,
                }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 14px" }}>
                        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <p style={{ color: "var(--text-secondary)", fontWeight: 700, fontSize: "0.88rem", marginBottom: 4 }}>No profiles match your filters</p>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>Try widening your search criteria.</p>
                </motion.div>
            ) : (
                <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
                    {results.map((p) => (
                        <ProfileCard
                            key={p.id}
                            profile={p}
                            statusById={statusById}
                            onRequest={onRequest}
                            onOpenDetails={openDetails}
                        />
                    ))}
                </div>
            )}

            <ProfileDetailsModal
                open={detailsOpen}
                profile={detailsProfile}
                statusById={statusById}
                onRequest={(id) => { onRequest(id); }}
                onClose={() => setDetailsOpen(false)}
            />
        </motion.div>
        </FeatureGate>
    );
}