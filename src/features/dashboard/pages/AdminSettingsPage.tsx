import { useEffect, useState } from 'react';
import { TopNav } from './TopNav';
import { adminApi } from '../../../utils/api';
import type { Package, Feature, CreatePackagePayload } from '../../../utils/api';
import { PointsDisplay } from '../../../components/PointsDisplay';

type FeatureWithFlags = Feature & {
    is_coming_soon?: number | boolean;
    scope?: string;
};

// ── Styles ─────────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--bg-input)',
    border: '1px solid var(--border-default)',
    borderRadius: '8px',
    padding: '11px 14px',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    fontFamily: "'Inter', sans-serif",
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
};

const labelStyle: React.CSSProperties = {
    fontSize: '0.6rem',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    fontWeight: 700,
    fontFamily: "'Inter', sans-serif",
    display: 'block',
    marginBottom: '6px',
};

// Coming-soon UI is now DB-driven via Feature.is_coming_soon
// (kept constant empty for legacy compatibility)
const COMING_SOON_FEATURE_KEYS = new Set();

// ── Icons ──────────────────────────────────────────────────────────────────────

const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
        fill="none" stroke="var(--gold-mid)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const LockIconSm = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
);

// ── Package type badge ─────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: 'user' | 'provider' }) {
    return (
        <span style={{
            fontSize: '0.55rem',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            padding: '2px 8px',
            borderRadius: '999px',
            background: type === 'provider'
                ? 'rgba(245,158,11,0.12)'
                : 'rgba(99,102,241,0.12)',
            color: type === 'provider' ? 'var(--gold-mid)' : '#818cf8',
            border: `1px solid ${type === 'provider' ? 'rgba(245,158,11,0.3)' : 'rgba(99,102,241,0.3)'}`,
        }}>
            {type === 'provider' ? '🏢 Provider' : '👤 User'}
        </span>
    );
}

// ── Feature checkboxes component ───────────────────────────────────────────────

function FeatureCheckboxes({
    features,
    selectedIds,
    onChange,
}: {
    features: Feature[];
    selectedIds: number[];
    onChange: (ids: number[]) => void;
}) {
    const toggle = (id: number) => {
        onChange(
            selectedIds.includes(id)
                ? selectedIds.filter(x => x !== id)
                : [...selectedIds, id]
        );
    };

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '8px',
        }}>
            {features.map(f => {
                const checked = selectedIds.includes(f.id);
                const isCS = !!(f as FeatureWithFlags).is_coming_soon;
                return (
                    <label
                        key={f.id}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            background: checked ? 'rgba(245,158,11,0.08)' : 'var(--bg-input)',
                            border: `1px solid ${checked ? 'rgba(245,158,11,0.3)' : 'var(--border-subtle)'}`,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            userSelect: 'none',
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(f.id)}
                            style={{ display: 'none' }}
                        />
                        <span style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '4px',
                            border: `1.5px solid ${checked ? 'var(--gold-mid)' : 'var(--border-default)'}`,
                            background: checked ? 'rgba(245,158,11,0.15)' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            transition: 'all 0.15s',
                        }}>
                            {checked && <CheckIcon />}
                        </span>
                        <span style={{
                            fontSize: '0.8rem',
                            fontFamily: "'Inter', sans-serif",
                            color: checked ? 'var(--text-primary)' : 'var(--text-secondary)',
                            flex: 1,
                        }}>
                            {f.display_name}
                        </span>
                        {isCS && (
                            <span style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.55rem',
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: '999px',
                                background: 'rgba(245,158,11,0.12)',
                                color: 'var(--gold-mid)',
                                border: '1px solid rgba(245,158,11,0.3)',
                                opacity: 0.85,
                                flexShrink: 0,
                            }}>
                                <LockIconSm /> Soon
                            </span>
                        )}
                    </label>
                );
            })}
        </div>
    );
}

// ── User feature input (DB-driven) ────────────────────────────────────────────

function UserFeatureCheckboxes({
    features,
    selectedKeys,
    onChange,
}: {
    features: Feature[];
    selectedKeys: string[];
    onChange: (keys: string[]) => void;
}) {
    const toggle = (key: string) => {
        onChange(
            selectedKeys.includes(key)
                ? selectedKeys.filter(k => k !== key)
                : [...selectedKeys, key]
        );
    };

    const displayFeatures = (features as FeatureWithFlags[])
        .filter(f => f.scope === 'user')
        .sort((a, b) => a.feature_key.localeCompare(b.feature_key));

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
            {displayFeatures.map(f => {
                const ff = f as FeatureWithFlags;
                const checked = selectedKeys.includes(ff.feature_key);
                return (
                    <label
                        key={ff.feature_key}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '10px 12px', borderRadius: '8px',
                            background: checked ? 'rgba(99,102,241,0.08)' : 'var(--bg-input)',
                            border: `1px solid ${checked ? 'rgba(99,102,241,0.3)' : 'var(--border-subtle)'}`,
                            cursor: 'pointer', transition: 'all 0.15s', userSelect: 'none',
                        }}
                    >
                        <input type="checkbox" checked={checked} onChange={() => toggle(ff.feature_key)} style={{ display: 'none' }} />
                        <span style={{
                            width: '16px', height: '16px', borderRadius: '4px',
                            border: `1.5px solid ${checked ? '#818cf8' : 'var(--border-default)'}`,
                            background: checked ? 'rgba(99,102,241,0.15)' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                            {checked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                        </span>
                        <span style={{ fontSize: '0.8rem', fontFamily: "'Inter', sans-serif", color: checked ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                            {f.display_name}
                        </span>
                        {f.is_coming_soon ? (
                            <span style={{
                                display: 'flex', alignItems: 'center', gap: '4px',
                                fontSize: '0.55rem', fontWeight: 700,
                                padding: '1px 6px', borderRadius: '999px',
                                background: 'rgba(245,158,11,0.12)',
                                color: 'var(--gold-mid)',
                                border: '1px solid rgba(245,158,11,0.3)',
                                opacity: 0.85,
                            }}>
                                <LockIconSm /> Soon
                            </span>
                        ) : null}
                    </label>
                );
            })}
        </div>
    );
}

// ── PackagesSection ────────────────────────────────────────────────────────────

function PackagesSection() {

    const [packages, setPackages] = useState<Package[]>([]);
    const [allFeatures, setAllFeatures] = useState<Feature[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showForm, setShowForm] = useState(false);

    // Form state
    const [pkgType, setPkgType] = useState<'user' | 'provider'>('user');
    const [form, setForm] = useState({
        name: '',
        description: '',
        price: 0,
        duration_months: 1,
        tier_type: 'premium',
        membership_level: 1,
    });
    const [selectedFeatureIds, setSelectedFeatureIds] = useState<number[]>([]); // for provider
    const [selectedUserFeatureKeys, setSelectedUserFeatureKeys] = useState<string[]>([]); // for user

    // Load packages + features
    const fetchAll = async () => {

        setLoading(true);
        const [pkgRes, featRes] = await Promise.all([
            adminApi.getPackages(),
            adminApi.getFeatures(),
        ]);
        if (pkgRes.data) setPackages(pkgRes.data);
        if (featRes.data) setAllFeatures(featRes.data);
        setLoading(false);
    };

    // Initial load
    useEffect(() => {
        const t = setTimeout(() => {
            void fetchAll();
        }, 0);
        return () => clearTimeout(t);
    }, []);

    const resetForm = () => {
        setForm({ name: '', description: '', price: 0, duration_months: 1, tier_type: 'premium', membership_level: 1 });
        setSelectedFeatureIds([]);
        setSelectedUserFeatureKeys([]);
        setPkgType('user');
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(''); setSuccess('');
        if (!form.name || !form.price) { setError('Name and price are required.'); return; }

        // For user type, resolve feature keys -> IDs
        let featureIds = selectedFeatureIds;
        let featuresCsv: string | undefined;
        if (pkgType === 'user') {
            featureIds = allFeatures
                .filter(f => selectedUserFeatureKeys.includes(f.feature_key))
                .map(f => f.id);
            featuresCsv = selectedUserFeatureKeys.join(',');
        }

        setSubmitting(true);
        const payload: CreatePackagePayload = {
            ...form,
            price: Number(form.price),
            duration_days: form.duration_months * 30,
            membership_level: Number(form.membership_level) || 1,
            type: pkgType,
            feature_ids: featureIds,
            features: featuresCsv,
        };

        const res = await adminApi.createPackage(payload);
        if (res.error) {
            setError(res.error);
        } else {
            setSuccess('Package created successfully!');
            resetForm();
            setShowForm(false);
            fetchAll();
        }
        setSubmitting(false);
    };

    const handleDelete = async (id: number, name: string) => {
        if (!window.confirm(`Delete package "${name}"?`)) return;
        const res = await adminApi.deletePackage(id);
        if (res.error) setError(res.error);
        else { setSuccess('Package deleted.'); fetchAll(); }
    };

    // Split packages by type
    const userPackages = packages.filter(p => p.type === 'user' || !p.type);
    const providerPackages = packages.filter(p => p.type === 'provider');

    // Provider feature selector is DB-driven: only features with scope='provider'.
    const providerFeatures = (allFeatures as FeatureWithFlags[])
        .filter(f => f.scope === 'provider')
        .sort((a, b) => a.display_name.localeCompare(b.display_name));

    const renderPackageCard = (pkg: Package) => {
        const features = Array.isArray(pkg.features)
            ? pkg.features
            : (typeof pkg.features === 'string' ? pkg.features.split(',').map((f: string) => ({ key: f.trim(), display_name: f.trim(), id: 0 })).filter((f: { key: string }) => f.key) : []);

        return (
            <div key={pkg.id} className="card gold-top-edge" style={{ position: 'relative' }}>
                {/* Header */}
                <div style={{
                    display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between',
                    alignItems: 'flex-start', gap: '16px',
                    borderBottom: '1px solid var(--border-subtle)',
                    paddingBottom: '16px', marginBottom: '16px',
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <TypeBadge type={(pkg.type as 'user' | 'provider') || 'user'} />
                            <span style={{
                                fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.05em',
                                textTransform: 'uppercase',
                                background: pkg.is_active ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                                color: pkg.is_active ? 'var(--green-status)' : 'var(--red-status)',
                                border: `1px solid ${pkg.is_active ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                padding: '2px 8px', borderRadius: 'var(--radius-pill)',
                            }}>
                                {pkg.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                        <span className="eyebrow" style={{ display: 'block', marginBottom: '4px' }}>
                            {pkg.tier_type}
                        </span>
                        <h3 style={{ fontSize: '1.3rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                            {pkg.name}
                        </h3>
                        {pkg.description && (
                            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                                {pkg.description}
                            </p>
                        )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                        <span style={{ fontSize: 'clamp(1.3rem, 3vw, 1.7rem)', fontWeight: 800, color: 'var(--gold-mid)', lineHeight: 1 }}>
                            {Number(pkg.price) === 0 ? 'Free' : <PointsDisplay amount={pkg.price} decimals={0} />}
                        </span>
                        <span className="badge badge-gold">
                            {pkg.duration_months} Month{pkg.duration_months > 1 ? 's' : ''}
                        </span>
                    </div>
                </div>

                {/* Features */}
                <div style={{ marginBottom: '16px' }}>
                    <p style={{
                        fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.25em',
                        textTransform: 'uppercase', color: 'var(--text-muted)',
                        marginBottom: '10px', fontFamily: 'var(--font-display)',
                    }}>
                        Included Features
                    </p>
                    {(features as Array<{ key: string; display_name: string; id: number }>).length > 0 ? (
                        <ul style={{
                            listStyle: 'none', padding: 0, margin: 0,
                            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '8px',
                        }}>
                            {(features as Array<{ key: string; display_name: string; id: number }>).map(f => {
                                const isCS = !!(f as unknown as { is_coming_soon?: boolean | number }).is_coming_soon || COMING_SOON_FEATURE_KEYS.has(f.key);
                                return (
                                    <li key={f.key || f.id} style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        fontSize: '0.82rem',
                                        color: isCS ? 'var(--text-muted)' : 'var(--text-secondary)',
                                        opacity: isCS ? 0.6 : 1,
                                    }}>
                                        <span style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            background: isCS ? 'var(--bg-input)' : 'var(--gold-glow)',
                                            border: `1px solid ${isCS ? 'var(--border-subtle)' : 'var(--border-gold)'}`,
                                            borderRadius: '50%', width: '20px', height: '20px', flexShrink: 0,
                                        }}>
                                            {isCS ? <LockIconSm /> : <CheckIcon />}
                                        </span>
                                        {f.display_name || f.key}
                                        {isCS && (
                                            <span style={{
                                                fontSize: '0.5rem', fontWeight: 700,
                                                padding: '1px 6px', borderRadius: '999px',
                                                background: 'rgba(245,158,11,0.12)',
                                                color: 'var(--gold-mid)',
                                                border: '1px solid rgba(245,158,11,0.3)',
                                                marginLeft: 'auto',
                                                flexShrink: 0,
                                            }}>
                                                Soon
                                            </span>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                            No features assigned.
                        </p>
                    )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
                    <button
                        onClick={() => handleDelete(pkg.id, pkg.name)}
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--red-status)', borderColor: 'rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', gap: '6px' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; }}
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
                        </svg>
                        Delete
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div style={{ marginBottom: '28px' }}>
            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <span style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 34, height: 34, borderRadius: '10px',
                    background: 'var(--blue-glow)', border: '1px solid rgba(59,130,246,0.3)', flexShrink: 0,
                }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--blue-vivid)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 3l-4 4-4-4" />
                    </svg>
                </span>
                <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter', sans-serif" }}>
                        Membership Packages
                    </p>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: "'Inter', sans-serif" }}>
                        Manage user and provider membership packages
                    </p>
                </div>
                <button
                    onClick={() => { setShowForm(v => !v); setError(''); setSuccess(''); if (showForm) resetForm(); }}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '8px 14px',
                        background: showForm ? 'rgba(59,130,246,0.08)' : 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
                        border: showForm ? '1px solid rgba(59,130,246,0.3)' : 'none',
                        borderRadius: '8px',
                        color: showForm ? 'var(--text-secondary)' : '#fff',
                        fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em',
                        textTransform: 'uppercase', fontFamily: "'Inter', sans-serif",
                        cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0,
                    }}
                >
                    {showForm ? <>✕ Cancel</> : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg> New Package</>}
                </button>
            </div>

            {/* Feedback */}
            {error && <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', color: '#fca5a5', fontSize: '0.8rem', marginBottom: '14px' }}>⚠ {error}</div>}
            {success && <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '8px', color: '#6ee7b7', fontSize: '0.8rem', marginBottom: '14px' }}>✓ {success}</div>}

            {/* Create Form */}
            {showForm && (
                <div className="card" style={{ marginBottom: '24px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, var(--blue-vivid), transparent)' }} />

                    <form onSubmit={handleCreate}>
                        {/* Package Type Toggle */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={labelStyle}>Package Type *</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {(['user', 'provider'] as const).map(t => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => { setPkgType(t); setSelectedFeatureIds([]); setSelectedUserFeatureKeys([]); }}
                                        style={{
                                            flex: 1,
                                            padding: '12px',
                                            borderRadius: '10px',
                                            border: pkgType === t
                                                ? `2px solid ${t === 'provider' ? 'var(--gold-mid)' : '#818cf8'}`
                                                : '1.5px solid var(--border-subtle)',
                                            background: pkgType === t
                                                ? (t === 'provider' ? 'rgba(245,158,11,0.08)' : 'rgba(99,102,241,0.08)')
                                                : 'var(--bg-input)',
                                            color: pkgType === t
                                                ? (t === 'provider' ? 'var(--gold-mid)' : '#818cf8')
                                                : 'var(--text-muted)',
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            fontFamily: "'Inter', sans-serif",
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            letterSpacing: '0.05em',
                                        }}
                                    >
                                        {t === 'user' ? '👤 User Package' : '🏢 Provider Package'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                            <div>
                                <label style={labelStyle}>Package Name *</label>
                                <input
                                    style={inputStyle}
                                    placeholder={pkgType === 'provider' ? 'e.g. Professional' : 'e.g. Gold Plan'}
                                    value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    required
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Price *</label>
                                <input
                                    style={inputStyle}
                                    type="number" min="0" step="0.01"
                                    placeholder="e.g. 999"
                                    value={form.price || ''}
                                    onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))}
                                    required
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                            <div>
                                <label style={labelStyle}>Tier Type</label>
                                <input
                                    style={inputStyle}
                                    placeholder={pkgType === 'provider' ? 'e.g. starter, professional, elite' : 'e.g. starter, premium, elite'}
                                    value={form.tier_type}
                                    onChange={e => setForm(f => ({ ...f, tier_type: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Duration (Months) *</label>
                                <select
                                    style={{ ...inputStyle, cursor: 'pointer' }}
                                    value={form.duration_months}
                                    onChange={e => setForm(f => ({ ...f, duration_months: parseInt(e.target.value) }))}
                                >
                                    <option value={1}>1 Month</option>
                                    <option value={3}>3 Months</option>
                                    <option value={6}>6 Months</option>
                                    <option value={12}>12 Months</option>
                                </select>
                            </div>
                            <div>
                                <label style={labelStyle}>Membership Level *</label>
                                <input
                                    style={inputStyle}
                                    type="number" min="1" step="1"
                                    title="Hierarchy level used for upgrade/downgrade rules. Silver=1, Gold=2, Platinum=3. Higher = higher tier."
                                    placeholder="e.g. 1, 2, 3"
                                    value={form.membership_level || ''}
                                    onChange={e => setForm(f => ({ ...f, membership_level: parseInt(e.target.value) || 1 }))}
                                    required
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={labelStyle}>Description</label>
                            <textarea
                                style={{ ...inputStyle, minHeight: '72px', resize: 'vertical' }}
                                placeholder="Short description of this package…"
                                value={form.description}
                                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            />
                        </div>

                        {/* Feature selection — different UI per type */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ ...labelStyle, marginBottom: '10px' }}>
                                {pkgType === 'provider' ? 'Provider Features' : 'User Features'}
                                <span style={{ marginLeft: '8px', color: 'var(--text-muted)', letterSpacing: 0, textTransform: 'none', fontWeight: 400 }}>
                                    — select all that apply
                                </span>
                            </label>
                            {pkgType === 'provider' ? (
                                providerFeatures.length > 0 ? (
                                    <FeatureCheckboxes
                                        features={providerFeatures}
                                        selectedIds={selectedFeatureIds}
                                        onChange={setSelectedFeatureIds}
                                    />
                                ) : (
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                        Loading features…
                                    </p>
                                )
                            ) : (
                                <UserFeatureCheckboxes
                                    features={allFeatures}
                                    selectedKeys={selectedUserFeatureKeys}
                                    onChange={setSelectedUserFeatureKeys}
                                />
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            style={{
                                width: '100%', padding: '13px',
                                background: submitting ? 'var(--bg-input)' : 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
                                border: 'none', borderRadius: '8px',
                                color: '#fff', fontWeight: 700,
                                fontSize: '0.7rem', letterSpacing: '0.15em',
                                textTransform: 'uppercase', fontFamily: "'Inter', sans-serif",
                                cursor: submitting ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                boxShadow: submitting ? 'none' : '0 0 20px rgba(59,130,246,0.35)',
                            }}
                        >
                            {submitting ? 'Creating…' : '✓ Create Package'}
                        </button>
                    </form>
                </div>
            )}

            {/* Package Lists */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Loading packages…
                </div>
            ) : (
                <>
                    {/* User Packages */}
                    <div style={{ marginBottom: '32px' }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            marginBottom: '14px', paddingBottom: '10px',
                            borderBottom: '1px solid var(--border-subtle)',
                        }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#818cf8', fontFamily: "'Inter', sans-serif" }}>
                                👤 User Packages
                            </span>
                            <span style={{
                                fontSize: '0.6rem', fontWeight: 700, padding: '2px 8px',
                                borderRadius: '999px', background: 'rgba(99,102,241,0.12)',
                                color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)',
                            }}>
                                {userPackages.length}
                            </span>
                        </div>
                        {userPackages.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '32px', background: 'var(--bg-card)', border: '1px dashed var(--border-subtle)', borderRadius: '12px' }}>
                                <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>👤</div>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No user packages yet.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {userPackages.map(renderPackageCard)}
                            </div>
                        )}
                    </div>

                    {/* Provider Packages */}
                    <div>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            marginBottom: '14px', paddingBottom: '10px',
                            borderBottom: '1px solid var(--border-subtle)',
                        }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold-mid)', fontFamily: "'Inter', sans-serif" }}>
                                🏢 Provider Packages
                            </span>
                            <span style={{
                                fontSize: '0.6rem', fontWeight: 700, padding: '2px 8px',
                                borderRadius: '999px', background: 'rgba(245,158,11,0.12)',
                                color: 'var(--gold-mid)', border: '1px solid rgba(245,158,11,0.3)',
                            }}>
                                {providerPackages.length}
                            </span>
                        </div>
                        {providerPackages.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '32px', background: 'var(--bg-card)', border: '1px dashed var(--border-subtle)', borderRadius: '12px' }}>
                                <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>🏢</div>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No provider packages yet. Create your first one!</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {providerPackages.map(renderPackageCard)}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

// ── AdminSettingsPage ──────────────────────────────────────────────────────────

export function AdminSettingsPage() {
    const [activeTab, setActiveTab] = useState<'packages'>('packages');


    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-main)', width: '100%', color: 'var(--text-primary)' }}>
            <TopNav />
            <div style={{ padding: 'clamp(90px, 22vw, 108px) clamp(12px, 4vw, 16px) clamp(32px, 8vw, 80px)', width: '100%', boxSizing: 'border-box' }}>
                {/* Title */}
                <div style={{ marginBottom: '22px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--blue-vivid)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 6px rgba(59,130,246,0.6))' }}>
                            <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                        <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: 'clamp(1.1rem, 5vw, 1.35rem)', fontWeight: 700, color: 'var(--text-primary)' }}>
                            Settings
                        </h2>
                    </div>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: "'Inter', sans-serif", letterSpacing: '0.05em' }}>
                        Manage user &amp; provider membership packages
                    </p>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', background: 'var(--bg-nav)', borderRadius: '10px', padding: '4px', border: '1px solid var(--border-subtle)', marginBottom: '24px', gap: '4px' }}>
                    {([{ key: 'packages', label: '📦 Packages', color: 'var(--blue-vivid)', bg: 'rgba(59,130,246,0.12)' }] as const).map(t => (
                        <button
                            key={t.key}
                            onClick={() => setActiveTab(t.key)}
                            style={{
                                flex: 1, padding: '10px 8px', border: 'none', borderRadius: '7px',
                                fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase',
                                fontWeight: 700, fontFamily: "'Inter', sans-serif", cursor: 'pointer',
                                background: activeTab === t.key ? t.bg : 'transparent',
                                color: activeTab === t.key ? t.color : 'var(--text-muted)',
                                transition: 'all 0.2s',
                            }}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {activeTab === 'packages' ? <PackagesSection /> : null}
            </div>
        </div>
    );
}
