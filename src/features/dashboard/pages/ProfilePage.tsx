import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { TopNav } from "./TopNav";
import { AdminAccountDeletionSection } from "./AdminAccountDeletionSection";
import { useAuth } from "../../../context/AuthContext";
import { useMembership } from "../../../context/MembershipContext";
import {
    userApi,
    type UpdateUserProfilePayload,
    type UserProfile,
} from "../../../utils/api";
import { useEffect, useMemo, useState } from "react";
import { resolveMediaUrl } from "../../../config/apiConfig";

function toFullUploadUrl(url: string) {
    return resolveMediaUrl(url);
}


const EDUCATION_OPTIONS = [
    "SSC",
    "HSC",
    "Diploma",
    "Bachelor's",
    "Master's",
    "PhD",
    "Other",
] as const;

const MARITAL_STATUS_OPTIONS = [
    "Single",
    "Married",
    "Divorced",
    "Widowed",
] as const;

const PROFESSION_OPTIONS = [
    "Student",
    "Software Engineer",
    "Doctor",
    "Engineer",
    "Teacher",
    "Lawyer",
    "Accountant",
    "Business Owner",
    "Entrepreneur",
    "Designer",
    "Artist",
    "Writer",
    "Nurse",
    "Civil Servant",
    "Banker",
    "Marketing Professional",
    "Sales Professional",
    "Consultant",
    "Researcher",
    "Other",
] as const;

const RELATIONSHIP_GOAL_OPTIONS = [
    "Serious Relationship",
    "Marriage",
    "Friendship",
    "Casual Dating",
    "Travel Partner",
    "Activity Partner",
    "Networking",
    "Open to Anything",
] as const;

const INTEREST_OPTIONS = [
    "Traveling",
    "Music",
    "Movies",
    "Reading",
    "Gaming",
    "Photography",
    "Cooking",
    "Fitness",
    "Gym",
    "Football",
    "Cricket",
    "Badminton",
    "Swimming",
    "Hiking",
    "Cycling",
    "Dancing",
    "Singing",
    "Art",
    "Fashion",
    "Technology",
    "Programming",
    "Business",
    "Entrepreneurship",
    "Pets",
    "Food",
    "Coffee",
    "Nature",
    "Volunteering",
    "Writing",
] as const;

const fadeUp = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const container = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.1 } },
};

function toDateInputValue(value: string | null | undefined): string {
    if (!value) return "";
    // backend can return DATE string as YYYY-MM-DD
    return value.slice(0, 10);
}

function interestsToArray(value: string | null | undefined): string[] {
    if (!value) return [];
    return value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
}

function arrayToInterestsString(items: string[]): string | null {
    const normalized = items.map((s) => s.trim()).filter(Boolean);
    if (normalized.length === 0) return null;
    return normalized.join(",");
}

function removeInterestAt(items: string[], item: string): string[] {
    return items.filter((x) => x !== item);
}

function uniqueInterests(items: string[]): string[] {
    return Array.from(new Set(items));
}

function labelForRole(role: UserProfile["role"]): string {
    if (role === "admin") return "Admin";
    if (role === "provider") return "Provider";
    return "User";
}

function allowedAvatarTypes(file: File): boolean {
    const name = file.name?.toLowerCase() ?? "";
    const extAllowed = [".jpg", ".jpeg", ".png", ".webp"].some((ext) => name.endsWith(ext));
    const mimeAllowed = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
    // Accept if either extension or mime matches
    return extAllowed || mimeAllowed;
}

export function ProfilePage() {
    const navigate = useNavigate();
    const { role } = useParams<{ role: string }>();
    const auth = useAuth();
    const { hasFeature } = useMembership();

    const [profile, setProfile] = useState<UserProfile | null>(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [editMode, setEditMode] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);
    const [editSuccess, setEditSuccess] = useState<string | null>(null);

    const [draft, setDraft] = useState<UpdateUserProfilePayload | null>(null);

    const memberSince = profile?.created_at
        ? new Date(profile.created_at).toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
          })
        : "Not set";

    const initials = useMemo(() => {
        const displayName = profile?.name ?? "";
        return displayName ? displayName.charAt(0) : "M";
    }, [profile?.name]);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError(null);
            const res = await userApi.getProfile();
            if (cancelled) return;
            if (res.error) {
                setError(res.error);
            } else {
                setProfile(res.data ?? null);
            }
            setLoading(false);
        };

        load();
        return () => {
            cancelled = true;
        };
    }, []);

    const refreshProfile = async () => {
        const res = await userApi.getProfile();
        if (res.error || !res.data) {
            throw new Error(res.error || "Failed to load profile");
        }
        setProfile(res.data);
        return res.data;
    };

    const handleLogout = () => {
        auth.logout();
        navigate("/");
    };

    const startEdit = () => {
        if (!profile) return;
        setEditError(null);
        setEditSuccess(null);
        setDraft({
            avatar_url: profile.avatar_url,
            name: profile.name,
            phone: profile.phone,
            gender: profile.gender,
            date_of_birth: profile.date_of_birth,
            profession: profile.profession,
            education: profile.education,
            location: profile.location,
            bio: profile.bio,
            interests: profile.interests,
            relationship_goal: profile.relationship_goal,
            marital_status: profile.marital_status,
        });
        setEditMode(true);
    };

    const cancelEdit = () => {
        setEditMode(false);
        setDraft(null);
        setEditError(null);
        setEditSuccess(null);
    };

    const validateDraft = (d: UpdateUserProfilePayload) => {
        if (!d.name || typeof d.name !== "string" || d.name.trim().length < 2) {
            return "Full Name must be at least 2 characters.";
        }
        if (!d.phone || typeof d.phone !== "string" || d.phone.trim().length < 6) {
            return "Phone is invalid.";
        }
        if (d.gender !== undefined && d.gender !== null && d.gender !== "") {
            const allowedGenders = [
                "male",
                "female",
                "other",
                "prefer_not_to_say",
            ];
            if (!allowedGenders.includes(d.gender)) {
                return "Invalid gender.";
            }
        }
        if (
            d.date_of_birth !== undefined &&
            d.date_of_birth !== null &&
            d.date_of_birth !== ""
        ) {
            const v = String(d.date_of_birth);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
                return "Date of Birth must be YYYY-MM-DD.";
            }
        }

        const education = d.education ?? null;
        if (!education) {
            return "Education must be selected.";
        }
        if (!EDUCATION_OPTIONS.includes(education as (typeof EDUCATION_OPTIONS)[number])) {
            return "Invalid education selected.";
        }

        const maritalStatus = d.marital_status ?? null;
        if (!maritalStatus) {
            return "Marital Status must be selected.";
        }
        if (!MARITAL_STATUS_OPTIONS.includes(maritalStatus as (typeof MARITAL_STATUS_OPTIONS)[number])) {
            return "Invalid marital status selected.";
        }

        const relationshipGoal = d.relationship_goal ?? null;
        if (!relationshipGoal) {
            return "Relationship Goal must be selected.";
        }
        if (
            !RELATIONSHIP_GOAL_OPTIONS.includes(
                relationshipGoal as (typeof RELATIONSHIP_GOAL_OPTIONS)[number]
            )
        ) {
            return "Invalid relationship goal selected.";
        }

        const interestsArr = interestsToArray(d.interests);
        const unique = uniqueInterests(interestsArr);
        if (unique.length !== interestsArr.length) {
            return "Interests must be unique.";
        }
        if (unique.length === 0) {
            return "At least one interest must be selected.";
        }

        return null;
    };

    const saveChanges = async () => {
        if (!draft) return;

        setEditError(null);
        setEditSuccess(null);

        const errMsg = validateDraft(draft);
        if (errMsg) {
            setEditError(errMsg);
            return;
        }

        setSaving(true);
        try {
            await userApi.updateProfile(draft);
            await refreshProfile();
            setEditMode(false);
            setDraft(null);
            setEditSuccess("Profile updated successfully.");
        } catch (e) {
            setEditError(e instanceof Error ? e.message : "Failed to update profile.");
        } finally {
            setSaving(false);
        }
    };

    // Visible avatar must NOT change immediately after upload.
    // It should only change after Save Changes (profile reload).
    const avatarSource = profile?.avatar_url || null;
    const avatarImgSrc = toFullUploadUrl(avatarSource ?? "");



    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={container}
            style={{ minHeight: "100vh", background: "var(--bg-main)", width: "100%" }}
        >
            <TopNav />

            <div
                style={{
                    width: "100%",
                    height: "1px",
                    background:
                        "linear-gradient(90deg, rgba(19,34,71,0.1) 0%, var(--border-default) 50%, rgba(19,34,71,0.1) 100%)",
                }}
            />

            <div
                style={{
                    width: "100%",
                    maxWidth: "2400px",
                    margin: "0 auto",
                    padding: "108px 16px 48px 16px",
                    boxSizing: "border-box",
                }}
            >
                <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
                    <motion.div
                        variants={fadeUp}
                        style={{ textAlign: "center", margin: "0 0 40px 0" }}
                    >
                                            <div
                                                style={{
                                                    width: "110px",
                                                    height: "110px",
                                                    borderRadius: "50%",
                                                    background: "linear-gradient(135deg, var(--blue-neon), var(--blue-vivid))",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    margin: "0 auto 16px",
                                                    border: "3px solid var(--border-subtle)",
                                                    fontSize: "3rem",
                                                    fontWeight: 700,
                                                    color: "#fff",
                                                    textTransform: "uppercase",
                                                    boxShadow: "var(--shadow-blue)",
                                                    overflow: "hidden",
                                                }}
                                            >
                            {avatarSource ? (
                                <img
                                    src={avatarImgSrc}
                                    alt="Avatar"
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                />
                            ) : (
                                initials
                            )}

                        </div>

                        <h3
                            style={{
                                fontSize: "1.75rem",
                                fontWeight: 600,
                                color: "var(--text-primary)",
                                marginBottom: "6px",
                                textTransform: "capitalize",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "8px",
                            }}
                        >
                            {profile?.name || "Loading…"}
                            {profile && !editMode && hasFeature('VERIFIED_BADGE') && (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                                    <circle cx="12" cy="12" r="12" fill="#1d9bf0" />
                                    <path d="M9 12.5l2 2 4-4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                </svg>
                            )}
                        </h3>
                        {editMode && (
                            <span
                                style={{
                                    display: "inline-block",
                                    fontSize: "0.65rem",
                                    letterSpacing: "0.15em",
                                    textTransform: "uppercase",
                                    color: "var(--blue-vivid)",
                                    fontFamily: "'Inter', sans-serif",
                                    fontWeight: 700,
                                    background: "var(--blue-glow)",
                                    padding: "6px 18px",
                                    borderRadius: "20px",
                                    border: "1px solid var(--border-subtle)",
                                }}
                            >
                                Editing
                            </span>
                        )}

                        {error && (
                            <div
                                style={{
                                    marginTop: 12,
                                    color: "var(--red-status)",
                                    fontSize: "0.85rem",
                                    fontWeight: 600,
                                }}
                            >
                                {error}
                            </div>
                        )}

                        {editSuccess && (
                            <div
                                style={{
                                    marginTop: 12,
                                    color: "#22c55e",
                                    fontSize: "0.85rem",
                                    fontWeight: 800,
                                }}
                            >
                                {editSuccess}
                            </div>
                        )}
                    </motion.div>

                    <div
                        style={{
                            display: "flex",
                            flexDirection: "row",
                            flexWrap: "wrap",
                            gap: "24px",
                            width: "100%",
                        }}
                    >
                        <motion.div
                            variants={fadeUp}
                            className="card"
                            style={{
                                flex: "1 1 500px",
                                padding: "32px",
                            }}
                        >
                            <span
                                style={{
                                    display: "block",
                                    fontSize: "0.7rem",
                                    letterSpacing: "0.15em",
                                    textTransform: "uppercase",
                                    color: "var(--blue-vivid)",
                                    fontWeight: 700,
                                    marginBottom: "24px",
                                }}
                            >
                                Identity Credentials
                            </span>

                            {loading ? (
                                <div style={{ color: "var(--text-muted)", fontWeight: 600 }}>Loading profile…</div>
                            ) : !profile ? (
                                <div style={{ color: "var(--red-status)", fontWeight: 700 }}>User not found.</div>
                            ) : (
                                <>
                                    {!editMode && auth.user?.role !== 'admin' && (
                                        <div style={{ marginBottom: 18 }}>
                                            <button
                                                onClick={startEdit}
                                                className="btn btn-primary"
                                                style={{ width: "100%", padding: "14px 16px" }}
                                            >
                                                Edit Profile
                                            </button>
                                        </div>
                                    )}

                                    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                                        {[
                                            { label: "Email", value: profile.email ?? "Not set" },
                                            { label: "Phone", value: profile.phone ?? "Not set" },
                                            { label: "Role", value: labelForRole(profile.role) },
                                            { label: "Member Since", value: memberSince },
                                        ].map((item) => (
                                            <div
                                                key={item.label}
                                                style={{
                                                    display: "flex",
                                                    justifyContent: "space-between",
                                                    fontSize: "0.9rem",
                                                    paddingBottom: "14px",
                                                    borderBottom: "1px solid var(--border-subtle)",
                                                }}
                                            >
                                                <span style={{ color: "var(--text-muted)" }}>{item.label}</span>
                                                <span
                                                    style={{
                                                        color: "var(--text-primary)",
                                                        fontWeight: 500,
                                                        wordBreak: "break-word",
                                                        textAlign: "right",
                                                    }}
                                                >
                                                    {item.value}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    {editMode && draft && (
                                        <div style={{ marginTop: 18 }}>
                                            {editError && (
                                                <div
                                                    style={{
                                                        marginBottom: 12,
                                                        padding: "10px 12px",
                                                        borderRadius: 10,
                                                        background: "rgba(239,68,68,0.08)",
                                                        border: "1px solid rgba(239,68,68,0.25)",
                                                        color: "var(--red-status)",
                                                        fontWeight: 800,
                                                    }}
                                                >
                                                    {editError}
                                                </div>
                                            )}

                                            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                                                <div>
                                                    <div
                                                        style={{
                                                            display: "block",
                                                            fontSize: "0.6rem",
                                                            letterSpacing: "0.18em",
                                                            textTransform: "uppercase",
                                                            color: "var(--text-muted)",
                                                            fontFamily: "'Inter', sans-serif",
                                                            fontWeight: 700,
                                                            marginBottom: 8,
                                                        }}
                                                    >
                                                        Full Name
                                                    </div>
                                                    <input
                                                        value={draft.name ?? ""}
                                                        onChange={(e) =>
                                                            setDraft((prev) => ({
                                                                ...(prev || {}),
                                                                name: e.target.value,
                                                            }))
                                                        }
                                                        style={{
                                                            width: "100%",
                                                            padding: "12px 16px",
                                                            background: "var(--bg-input)",
                                                            border: "1px solid var(--border-default)",
                                                            borderRadius: 8,
                                                            color: "var(--text-primary)",
                                                        }}
                                                    />
                                                </div>

                                                <div>
                                                    <div
                                                        style={{
                                                            display: "block",
                                                            fontSize: "0.6rem",
                                                            letterSpacing: "0.18em",
                                                            textTransform: "uppercase",
                                                            color: "var(--text-muted)",
                                                            fontFamily: "'Inter', sans-serif",
                                                            fontWeight: 700,
                                                            marginBottom: 8,
                                                        }}
                                                    >
                                                        Gender
                                                    </div>
                                                    <select
                                                        value={draft.gender ?? ""}
                                                        onChange={(e) =>
                                                            setDraft((prev) => ({
                                                                ...(prev || {}),
                                                                gender: e.target.value || null,
                                                            }))
                                                        }
                                                        style={{
                                                            width: "100%",
                                                            padding: "12px 16px",
                                                            background: "var(--bg-input)",
                                                            border: "1px solid var(--border-default)",
                                                            borderRadius: 8,
                                                            color: "var(--text-primary)",
                                                        }}
                                                    >
                                                        <option value="">Prefer not to say</option>
                                                        <option value="male">Male</option>
                                                        <option value="female">Female</option>
                                                        <option value="other">Other</option>
                                                        <option value="prefer_not_to_say">Prefer not to say</option>
                                                    </select>
                                                </div>

                                                <div>
                                                    <div
                                                        style={{
                                                            display: "block",
                                                            fontSize: "0.6rem",
                                                            letterSpacing: "0.18em",
                                                            textTransform: "uppercase",
                                                            color: "var(--text-muted)",
                                                            fontFamily: "'Inter', sans-serif",
                                                            fontWeight: 700,
                                                            marginBottom: 8,
                                                        }}
                                                    >
                                                        Date of Birth
                                                    </div>
                                                    <input
                                                        type="date"
                                                        value={toDateInputValue(draft.date_of_birth)}
                                                        onChange={(e) =>
                                                            setDraft((prev) => ({
                                                                ...(prev || {}),
                                                                date_of_birth: e.target.value || null,
                                                            }))
                                                        }
                                                        style={{
                                                            width: "100%",
                                                            padding: "12px 16px",
                                                            background: "var(--bg-input)",
                                                            border: "1px solid var(--border-default)",
                                                            borderRadius: 8,
                                                            color: "var(--text-primary)",
                                                        }}
                                                    />
                                                </div>

                                                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                                                    <div style={{ flex: "1 1 200px" }}>
                                                        <div
                                                            style={{
                                                                display: "block",
                                                                fontSize: "0.6rem",
                                                                letterSpacing: "0.18em",
                                                                textTransform: "uppercase",
                                                                color: "var(--text-muted)",
                                                                fontFamily: "'Inter', sans-serif",
                                                                fontWeight: 700,
                                                                marginBottom: 8,
                                                            }}
                                                        >
                                                            Profession
                                                        </div>
                                                        <select
                                                            value={draft.profession ?? ""}
                                                            onChange={(e) =>
                                                                setDraft((prev) => ({
                                                                    ...(prev || {}),
                                                                    profession: e.target.value || null,
                                                                }))
                                                            }
                                                            style={{
                                                                width: "100%",
                                                                padding: "12px 16px",
                                                                background: "var(--bg-input)",
                                                                border: "1px solid var(--border-default)",
                                                                borderRadius: 8,
                                                                color: "var(--text-primary)",
                                                            }}
                                                        >
                                                            <option value="">Select profession</option>
                                                            {PROFESSION_OPTIONS.map((opt) => (
                                                                <option key={opt} value={opt}>
                                                                    {opt}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    <div style={{ flex: "1 1 200px" }}>
                                                        <div
                                                            style={{
                                                                display: "block",
                                                                fontSize: "0.6rem",
                                                                letterSpacing: "0.18em",
                                                                textTransform: "uppercase",
                                                                color: "var(--text-muted)",
                                                                fontFamily: "'Inter', sans-serif",
                                                                fontWeight: 700,
                                                                marginBottom: 8,
                                                            }}
                                                        >
                                                            Education
                                                        </div>
                                                        <select
                                                            value={draft.education ?? ""}
                                                            onChange={(e) =>
                                                                setDraft((prev) => ({
                                                                    ...(prev || {}),
                                                                    education: e.target.value || null,
                                                                }))
                                                            }
                                                            style={{
                                                                width: "100%",
                                                                padding: "12px 16px",
                                                                background: "var(--bg-input)",
                                                                border: "1px solid var(--border-default)",
                                                                borderRadius: 8,
                                                                color: "var(--text-primary)",
                                                            }}
                                                        >
                                                            <option value="">Select education</option>
                                                            {EDUCATION_OPTIONS.map((opt) => (
                                                                <option key={opt} value={opt}>
                                                                    {opt}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>

                                                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                                                    <div style={{ flex: "1 1 260px" }}>
                                                        <div
                                                            style={{
                                                                display: "block",
                                                                fontSize: "0.6rem",
                                                                letterSpacing: "0.18em",
                                                                textTransform: "uppercase",
                                                                color: "var(--text-muted)",
                                                                fontFamily: "'Inter', sans-serif",
                                                                fontWeight: 700,
                                                                marginBottom: 8,
                                                            }}
                                                        >
                                                            Location
                                                        </div>
                                                        <input
                                                            value={draft.location ?? ""}
                                                            onChange={(e) =>
                                                                setDraft((prev) => ({
                                                                    ...(prev || {}),
                                                                    location: e.target.value || null,
                                                                }))
                                                            }
                                                            style={{
                                                                width: "100%",
                                                                padding: "12px 16px",
                                                                background: "var(--bg-input)",
                                                                border: "1px solid var(--border-default)",
                                                                borderRadius: 8,
                                                                color: "var(--text-primary)",
                                                            }}
                                                        />
                                                    </div>

                                                    <div style={{ flex: "1 1 200px" }}>
                                                        <div
                                                            style={{
                                                                display: "block",
                                                                fontSize: "0.6rem",
                                                                letterSpacing: "0.18em",
                                                                textTransform: "uppercase",
                                                                color: "var(--text-muted)",
                                                                fontFamily: "'Inter', sans-serif",
                                                                fontWeight: 700,
                                                                marginBottom: 8,
                                                            }}
                                                        >
                                                            Marital Status
                                                        </div>
                                                        <select
                                                            value={draft.marital_status ?? ""}
                                                            onChange={(e) =>
                                                                setDraft((prev) => ({
                                                                    ...(prev || {}),
                                                                    marital_status: e.target.value || null,
                                                                }))
                                                            }
                                                            style={{
                                                                width: "100%",
                                                                padding: "12px 16px",
                                                                background: "var(--bg-input)",
                                                                border: "1px solid var(--border-default)",
                                                                borderRadius: 8,
                                                                color: "var(--text-primary)",
                                                            }}
                                                        >
                                                            <option value="">Select marital status</option>
                                                            {MARITAL_STATUS_OPTIONS.map((opt) => (
                                                                <option key={opt} value={opt}>
                                                                    {opt}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>

                                                <div>
                                                    <div
                                                        style={{
                                                            display: "block",
                                                            fontSize: "0.6rem",
                                                            letterSpacing: "0.18em",
                                                            textTransform: "uppercase",
                                                            color: "var(--text-muted)",
                                                            fontFamily: "'Inter', sans-serif",
                                                            fontWeight: 700,
                                                            marginBottom: 8,
                                                        }}
                                                    >
                                                        Bio
                                                    </div>
                                                    <textarea
                                                        value={draft.bio ?? ""}
                                                        onChange={(e) =>
                                                            setDraft((prev) => ({
                                                                ...(prev || {}),
                                                                bio: e.target.value || null,
                                                            }))
                                                        }
                                                        rows={4}
                                                        style={{
                                                            width: "100%",
                                                            padding: "12px 16px",
                                                            background: "var(--bg-input)",
                                                            border: "1px solid var(--border-default)",
                                                            borderRadius: 8,
                                                            color: "var(--text-primary)",
                                                            resize: "vertical",
                                                        }}
                                                    />
                                                </div>

                                                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                                                    <div style={{ flex: "1 1 260px" }}>
                                                        <div
                                                            style={{
                                                                display: "block",
                                                                fontSize: "0.6rem",
                                                                letterSpacing: "0.18em",
                                                                textTransform: "uppercase",
                                                                color: "var(--text-muted)",
                                                                fontFamily: "'Inter', sans-serif",
                                                                fontWeight: 700,
                                                                marginBottom: 8,
                                                            }}
                                                        >
                                                            Interests
                                                        </div>

                                                        {(() => {
                                                            const interestsArr = interestsToArray(draft.interests);

                                                            return (
                                                                <>
                                                                    <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                                                                        <select
                                                                            value=""
                                                                            onChange={(e) => {
                                                                                const next = e.target.value;
                                                                                if (!next) return;
                                                                                setDraft((prev) => {
                                                                                    const prevArr = interestsToArray(prev?.interests);
                                                                                    if (prevArr.includes(next)) return prev || {};
                                                                                    const merged = uniqueInterests([...prevArr, next]);
                                                                                    return {
                                                                                        ...(prev || {}),
                                                                                        interests: arrayToInterestsString(merged),
                                                                                    };
                                                                                });
                                                                            }}
                                                                            style={{
                                                                                flex: 1,
                                                                                padding: "12px 16px",
                                                                                background: "var(--bg-input)",
                                                                                border: "1px solid var(--border-default)",
                                                                                borderRadius: 8,
                                                                                color: "var(--text-primary)",
                                                                            }}
                                                                        >
                                                                            <option value="">Select interest</option>
                                                                            {INTEREST_OPTIONS.map((opt) => (
                                                                                <option key={opt} value={opt}>
                                                                                    {opt}
                                                                                </option>
                                                                            ))}
                                                                        </select>

                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                // no-op: selection is handled onChange; keep button to match UX
                                                                            }}
                                                                            disabled
                                                                            style={{
                                                                                padding: "12px 16px",
                                                                                background: "transparent",
                                                                                border: "1px solid rgba(59,130,246,0.25)",
                                                                                borderRadius: 8,
                                                                                color: "rgba(59,130,246,0.6)",
                                                                                fontWeight: 900,
                                                                                cursor: "not-allowed",
                                                                            }}
                                                                        >
                                                                            Add
                                                                        </button>
                                                                    </div>

                                                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                                                                        {interestsArr.length === 0 ? (
                                                                            <div style={{ color: "var(--text-muted)", fontWeight: 700 }}>
                                                                                Select at least one interest.
                                                                            </div>
                                                                        ) : (
                                                                            interestsArr.map((interest) => (
                                                                                <span
                                                                                    key={interest}
                                                                                    style={{
                                                                                        display: "inline-flex",
                                                                                        alignItems: "center",
                                                                                        gap: 8,
                                                                                        padding: "8px 12px",
                                                                                        borderRadius: 999,
                                                                                        background:
                                                                                            "linear-gradient(135deg, rgba(59,130,246,0.18), rgba(59,130,246,0.06))",
                                                                                        border: "1px solid var(--border-subtle)",
                                                                                        color: "var(--text-primary)",
                                                                                        fontWeight: 800,
                                                                                        fontSize: "0.8rem",
                                                                                    }}
                                                                                >
                                                                                    {interest}
                                                                                    <button
                                                                                        type="button"
                                                                                        aria-label={`Remove ${interest}`}
                                                                                        onClick={() => {
                                                                                            setDraft((prev) => {
                                                                                                const prevArr = interestsToArray(prev?.interests);
                                                                                                const nextArr = removeInterestAt(prevArr, interest);
                                                                                                return {
                                                                                                    ...(prev || {}),
                                                                                                    interests: arrayToInterestsString(nextArr),
                                                                                                };
                                                                                            });
                                                                                        }}
                                                                                        style={{
                                                                                            width: 20,
                                                                                            height: 20,
                                                                                            borderRadius: "50%",
                                                                                            border: "1px solid rgba(255,255,255,0.18)",
                                                                                            background: "rgba(0,0,0,0.12)",
                                                                                            color: "#fff",
                                                                                            cursor: "pointer",
                                                                                            display: "flex",
                                                                                            alignItems: "center",
                                                                                            justifyContent: "center",
                                                                                            fontWeight: 1000,
                                                                                            lineHeight: 1,
                                                                                        }}
                                                                                    >
                                                                                        ×
                                                                                    </button>
                                                                                </span>
                                                                            ))
                                                                        )}
                                                                    </div>
                                                                </>
                                                            );
                                                        })()}
                                                    </div>

                                                    <div style={{ flex: "1 1 260px" }}>
                                                        <div
                                                            style={{
                                                                display: "block",
                                                                fontSize: "0.6rem",
                                                                letterSpacing: "0.18em",
                                                                textTransform: "uppercase",
                                                                color: "var(--text-muted)",
                                                                fontFamily: "'Inter', sans-serif",
                                                                fontWeight: 700,
                                                                marginBottom: 8,
                                                            }}
                                                        >
                                                            Relationship Goal
                                                        </div>
                                                        <select
                                                            value={draft.relationship_goal ?? ""}
                                                            onChange={(e) =>
                                                                setDraft((prev) => ({
                                                                    ...(prev || {}),
                                                                    relationship_goal: e.target.value || null,
                                                                }))
                                                            }
                                                            style={{
                                                                width: "100%",
                                                                padding: "12px 16px",
                                                                background: "var(--bg-input)",
                                                                border: "1px solid var(--border-default)",
                                                                borderRadius: 8,
                                                                color: "var(--text-primary)",
                                                            }}
                                                        >
                                                            <option value="">Select relationship goal</option>
                                                            {RELATIONSHIP_GOAL_OPTIONS.map((opt) => (
                                                                <option key={opt} value={opt}>
                                                                    {opt}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>

                                                <div>
                                                    <div
                                                        style={{
                                                            display: "block",
                                                            fontSize: "0.6rem",
                                                            letterSpacing: "0.18em",
                                                            textTransform: "uppercase",
                                                            color: "var(--text-muted)",
                                                            fontFamily: "'Inter', sans-serif",
                                                            fontWeight: 700,
                                                            marginBottom: 8,
                                                        }}
                                                    >
                                                        Avatar
                                                    </div>
                                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                                                        <input
                                                            type="file"
                                                            accept="image/png,image/jpeg,image/webp"
                                                            disabled={saving}
                                                            onChange={async (e) => {
                                                                const file = e.target.files?.[0];
                                                                if (!file) return;

                                                                if (!allowedAvatarTypes(file)) {
                                                                    setEditError("Only jpg, jpeg, png, webp images are allowed.");
                                                                    return;
                                                                }
                                                                if (file.size > 5 * 1024 * 1024) {
                                                                    setEditError("Maximum file size is 5MB.");
                                                                    return;
                                                                }

                                                                setEditError(null);
                                                                setEditSuccess(null);
                                                                setSaving(true);
                                                                try {
                                                                    // Upload immediately and set URL in draft
const uploadRes = await userApi.uploadImage(file, 'avatars');

                                                                    if (uploadRes.error || !uploadRes.data?.url) {
                                                                        throw new Error(uploadRes.error || "Upload failed");
                                                                    }

                                                            setDraft((prev) => ({
                                                                ...(prev || {}),
                                                                avatar_url: uploadRes.data!.url,
                                                            }));

                                                            // Do NOT update visible avatar preview until Save Changes.

                                                                } catch (err) {
                                                                    setEditError(err instanceof Error ? err.message : "Avatar upload failed.");
                                                                } finally {
                                                                    setSaving(false);
                                                                }
                                                            }}
                                                        />


                                                        {/* Preview intentionally removed: visible avatar updates only after Save Changes */}
                                                        {avatarSource ? (
                                                            <div
                                                                style={{
                                                                    width: 64,
                                                                    height: 64,
                                                                    borderRadius: "50%",
                                                                    overflow: "hidden",
                                                                    border: "1px solid var(--border-subtle)",
                                                                }}
                                                            >
                                                                <img
                                                                    src={avatarImgSrc}
                                                                    alt="Avatar"
                                                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div style={{ color: "var(--text-muted)", fontWeight: 700 }}>
                                                                No avatar selected
                                                            </div>
                                                        )}

                                                    </div>
                                                </div>

                                                <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                                                    <button
                                                        type="button"
                                                        onClick={saveChanges}
                                                        disabled={saving}
                                                        style={{
                                                            flex: 1,
                                                            padding: "14px",
                                                            background: saving
                                                                ? "rgba(59,130,246,0.4)"
                                                                : "linear-gradient(135deg, var(--blue-neon), var(--blue-vivid))",
                                                            border: "none",
                                                            borderRadius: 10,
                                                            color: "#fff",
                                                            fontWeight: 800,
                                                            cursor: saving ? "not-allowed" : "pointer",
                                                        }}
                                                    >
                                                        {saving ? "Saving…" : "Save Changes"}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={cancelEdit}
                                                        disabled={saving}
                                                        style={{
                                                            flex: 1,
                                                            padding: "14px",
                                                            background: "transparent",
                                                            border: "1px solid var(--border-subtle)",
                                                            borderRadius: 10,
                                                            color: "var(--text-primary)",
                                                            fontWeight: 800,
                                                            cursor: saving ? "not-allowed" : "pointer",
                                                        }}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </motion.div>

                        <motion.div
                            variants={fadeUp}
                            className="card"
                            style={{
                                flex: "1 1 380px",
                                padding: "32px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "16px",
                                justifyContent: "center",
                            }}
                        >
                            <span
                                style={{
                                    display: "block",
                                    fontSize: "0.7rem",
                                    letterSpacing: "0.15em",
                                    textTransform: "uppercase",
                                    color: "var(--text-muted)",
                                    fontWeight: 700,
                                    marginBottom: "8px",
                                }}
                            >
                                Account Management
                            </span>

                            {role !== "admin" && (
                                <button
                                    style={{
                                        width: "100%",
                                        padding: "16px",
                                        background: "transparent",
                                        border: "1px solid var(--border-subtle)",
                                        borderRadius: "10px",
                                        color: "var(--blue-vivid)",
                                        fontSize: "0.85rem",
                                        fontWeight: 600,
                                        cursor: "pointer",
                                        fontFamily: "'Inter', sans-serif",
                                        transition: "all 0.2s ease",
                                    }}
                                    onClick={() => navigate("../network")}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--blue-glow)")}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                                >
                                    Referral
                                </button>
                            )}

                            <button
                                style={{
                                    width: "100%",
                                    padding: "16px",
                                    background: "transparent",
                                    border: "1px solid var(--border-subtle)",
                                    borderRadius: "10px",
                                    color: "var(--blue-vivid)",
                                    fontSize: "0.85rem",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    fontFamily: "'Inter', sans-serif",
                                    transition: "all 0.2s ease",
                                }}
                                onClick={() => navigate("../change-password")}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--blue-glow)")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                                Change Password
                            </button>

                            {role === "admin" && <AdminAccountDeletionSection />}

                            <button
                                onClick={handleLogout}
                                style={{
                                    width: "100%",
                                    padding: "16px",
                                    background: "rgba(239, 68, 68, 0.06)",
                                    border: "1px solid rgba(239, 68, 68, 0.3)",
                                    borderRadius: "10px",
                                    color: "var(--red-status)",
                                    fontSize: "0.85rem",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    fontFamily: "'Inter', sans-serif",
                                    transition: "all 0.2s ease",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239, 68, 68, 0.12)")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(239, 68, 68, 0.06)")}
                            >
                                Sign Out
                            </button>
                        </motion.div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

