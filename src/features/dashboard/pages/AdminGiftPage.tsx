import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { TopNav } from './TopNav';
import { adminGiftApi } from '../../gift/services/giftApi';
import type { Gift, GiftAsset } from '../../gift/types/gift';
import { useToast } from '../../../components/Toast';
import { useConfirmDialog } from '../../../components/ConfirmDialog';
import { PointsDisplay } from '../../../components/PointsDisplay';

const fadeUp = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const GiftIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="8" width="18" height="4" rx="1" />
        <path d="M12 8v13" />
        <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
        <path d="M12 8c-2 0-4-1.5-4-3a2 2 0 0 1 4 0c0-1.5 2-3 4-3a2 2 0 0 1 0 3c0 1.5-2 3-4 3z" />
    </svg>
);

const MiniSpinner = ({ color = '#0a0a0a' }: { color?: string }) => (
    <span style={{
        display: 'inline-block', width: 12, height: 12, borderRadius: '50%',
        border: `2px solid ${color}33`, borderTopColor: color,
        animation: 'spin 0.8s linear infinite', marginRight: 6, verticalAlign: 'middle',
    }} />
);

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_SIZE = 5 * 1024 * 1024;

interface FormState {
    name: string;
    price: string;
    provider_percentage: string;
    admin_percentage: string;
}

const emptyForm: FormState = {
    name: '',
    price: '',
    provider_percentage: '70',
    admin_percentage: '30',
};

export function AdminGiftPage() {
    const toast = useToast();
    const confirmDialog = useConfirmDialog();
    const [gifts, setGifts] = useState<Gift[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [togglingId, setTogglingId] = useState<number | null>(null);
    const [form, setForm] = useState<FormState>(emptyForm);
    const [assetId, setAssetId] = useState<number | null>(null);

    // Asset library
    const [assets, setAssets] = useState<GiftAsset[]>([]);
    const [assetsLoading, setAssetsLoading] = useState(true);
    const [assetBusy, setAssetBusy] = useState<{ action: 'toggle' | 'delete'; id: number } | null>(null);
    const [showUpload, setShowUpload] = useState(false);
    const [uploadName, setUploadName] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadPreview, setUploadPreview] = useState<string | null>(null);
    const pendingFileRef = useRef<File | null>(null);

    const loadGifts = async () => {
        setLoading(true);
        const res = await adminGiftApi.getGifts();
        if (!res.error && res.data) setGifts(res.data.gifts);
        setLoading(false);
    };

    const loadAssets = async () => {
        setAssetsLoading(true);
        const res = await adminGiftApi.getAssets();
        if (!res.error && res.data) setAssets(res.data.assets);
        setAssetsLoading(false);
    };

    useEffect(() => {
        loadGifts();
        loadAssets();
    }, []);

    const startAdd = () => {
        setEditingId(null);
        setForm(emptyForm);
        setAssetId(null);
        setShowForm(true);
    };

    const startEdit = (g: Gift) => {
        setEditingId(g.id);
        setForm({
            name: g.name,
            price: String(g.price),
            provider_percentage: String(g.provider_percentage),
            admin_percentage: String(g.admin_percentage),
        });
        setAssetId(g.asset_id ?? null);
        setShowForm(true);
    };

    const handleSave = async () => {
        const price = Number(form.price);
        const providerPct = Number(form.provider_percentage);
        const adminPct = Number(form.admin_percentage);
        if (!form.name.trim()) { toast.error('Name is required'); return; }
        if (!Number.isFinite(price) || price <= 0) { toast.error('Price must be > 0'); return; }
        if (!Number.isFinite(providerPct) || !Number.isFinite(adminPct) || providerPct < 0 || adminPct < 0 || providerPct > 100 || adminPct > 100) {
            toast.error('Percentages must be between 0 and 100');
            return;
        }

        const payload = {
            name: form.name.trim(),
            price,
            provider_percentage: providerPct,
            admin_percentage: adminPct,
            asset_id: assetId,
        };

        setSubmitting(true);
        const res = editingId
            ? await adminGiftApi.updateGift(editingId, payload)
            : await adminGiftApi.createGift(payload);
        setSubmitting(false);

        if (!res.error) {
            toast.success(editingId ? 'Gift updated successfully.' : 'Gift created successfully.');
            setShowForm(false);
            await loadGifts();
        } else {
            toast.error(res.error || 'Failed to save gift');
        }
    };

    const handleToggle = async (g: Gift) => {
        if (togglingId !== null) return; // prevent duplicate requests while a toggle is in flight
        const activating = !(g.is_active === 1);
        setTogglingId(g.id);
        try {
            const res = await adminGiftApi.toggleGift(g.id, activating);
            if (!res.error) {
                toast.success(activating ? 'Gift activated.' : 'Gift deactivated.');
                await loadGifts();
            } else {
                toast.error(res.error || 'Failed to update gift status');
            }
        } finally {
            setTogglingId(null);
        }
    };

    const handleDelete = async (g: Gift) => {
        const ok = await confirmDialog({
            title: `Delete "${g.name}"?`,
            message: 'This action cannot be undone.',
            confirmLabel: 'Delete',
            variant: 'danger',
        });
        if (!ok) return;
        const res = await adminGiftApi.deleteGift(g.id);
        if (!res.error) {
            toast.success('Gift deleted.');
            await loadGifts();
        } else {
            toast.error(res.error || 'Failed to delete gift');
        }
    };

    // ── Asset library actions ──
    const handleAssetFile = (file: File | undefined) => {
        if (!file) return;
        if (!ALLOWED_TYPES.has(file.type)) {
            toast.error('Only JPG, PNG, WebP or GIF images are allowed.');
            return;
        }
        if (file.size > MAX_SIZE) {
            toast.error('Maximum file size is 5MB.');
            return;
        }
        setUploadPreview(URL.createObjectURL(file));
        pendingFileRef.current = file;
    };

    const handleUploadAsset = async () => {
        const file = pendingFileRef.current;
        const name = uploadName.trim();
        if (!file) { toast.error('Choose an image/GIF to upload'); return; }
        if (!name) { toast.error('Give the asset a name'); return; }
        setUploading(true);
        const res = await adminGiftApi.createAsset(file, name);
        setUploading(false);
        if (!res.error) {
            toast.success('Asset added to the library.');
            setShowUpload(false);
            setUploadName('');
            setUploadPreview(null);
            pendingFileRef.current = null;
            if (res.data?.asset) setAssetId(res.data.asset.id);
            await loadAssets();
        } else {
            toast.error(res.error || 'Failed to upload asset');
        }
    };

    const handleToggleAsset = async (a: GiftAsset) => {
        setAssetBusy({ action: 'toggle', id: a.id });
        const res = await adminGiftApi.updateAsset(a.id, { is_active: !(a.is_active === 1) });
        setAssetBusy(null);
        if (!res.error) {
            toast.success('Asset status updated.');
            await loadAssets();
        } else {
            toast.error(res.error || 'Failed to update asset');
        }
    };

    const handleDeleteAsset = async (a: GiftAsset) => {
        const ok = await confirmDialog({
            title: `Delete asset "${a.name}"?`,
            message: 'Gifts using this asset must be reassigned first. This action cannot be undone.',
            confirmLabel: 'Delete',
            variant: 'danger',
        });
        if (!ok) return;
        setAssetBusy({ action: 'delete', id: a.id });
        const res = await adminGiftApi.deleteAsset(a.id);
        setAssetBusy(null);
        if (!res.error) {
            toast.success('Asset deleted.');
            if (assetId === a.id) setAssetId(null);
            await loadAssets();
        } else {
            toast.error(res.error || 'Failed to delete asset');
        }
    };

    const inputStyle: React.CSSProperties = {
        width: '100%',
        background: 'var(--bg-input)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
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

    const assetThumb = (a: { url: string; name: string }) => (
        <img
            src={a.url}
            alt={a.name}
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
        />
    );

    const giftVisual = (g: Gift) => {
        const url = g.asset?.url || g.image;
        if (url) {
            return <img src={url} alt={g.name} style={{ width: 32, height: 32, objectFit: 'contain' }} />;
        }
        return <span style={{ fontSize: '1.4rem' }}>{g.icon || '🎁'}</span>;
    };

    return (
        <>
            <TopNav />
            <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 40px' }}>
                {/* Page header */}
                <motion.div variants={fadeUp} initial="hidden" animate="show" style={{ marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, var(--gold-deep), var(--gold-mid))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-gold)', flexShrink: 0 }}>
                        <GiftIcon />
                    </div>
                    <div style={{ flex: 1 }}>
                        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>Gift Management</h1>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Manage chat gifts & the reusable asset library</p>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={startAdd}>+ Add Gift</button>
                </motion.div>

                {/* ── Gift Asset Library ── */}
                <motion.div variants={fadeUp} initial="hidden" animate="show" className="card" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-6)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                        <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>Gift Asset Library</h2>
                        <button className="btn btn-outline btn-sm" onClick={() => { setShowUpload(v => !v); setUploadPreview(null); setUploadName(''); pendingFileRef.current = null; }}>
                            {showUpload ? 'Cancel' : '+ Add Asset'}
                        </button>
                    </div>

                    {/* Upload */}
                    {showUpload && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', marginBottom: 'var(--space-4)' }}>
                            <div>
                                <label style={labelStyle}>Asset name *</label>
                                <input style={inputStyle} value={uploadName} onChange={e => setUploadName(e.target.value)} placeholder="e.g. Rose animation" />
                            </div>
                            <div>
                                <label style={labelStyle}>GIF / Image (JPG, PNG, WebP, GIF, max 5MB) *</label>
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/gif"
                                    onChange={(e) => handleAssetFile(e.target.files?.[0])}
                                    style={{ ...inputStyle, padding: '8px' }}
                                />
                            </div>
                            {uploadPreview && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                    <div style={{ width: 56, height: 56, borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                                        <img src={uploadPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                    </div>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Preview — file will be stored via the platform storage provider.</span>
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button className="btn btn-primary btn-sm" onClick={handleUploadAsset} disabled={uploading}>
                                    {uploading ? 'Uploading…' : 'Add to Library'}
                                </button>
                            </div>
                        </div>
                    )}

                    {assetsLoading ? (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>Loading assets…</p>
                    ) : assets.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>No assets yet. Click "+ Add Asset" to upload a GIF/image.</p>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 'var(--space-3)' }}>
                            {assets.map(a => {
                                const busy = assetBusy?.id === a.id;
                                return (
                                    <div key={a.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--bg-input)' }}>
                                        <div style={{ width: '100%', height: 64, background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
                                            <div style={{ width: 52, height: 52 }}>{assetThumb(a)}</div>
                                        </div>
                                        <div style={{ padding: '6px 8px' }}>
                                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                                            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                {a.asset_type}{a.is_active === 1 ? ' • active' : ' • off'}
                                            </div>
                                            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                                                <button className="btn btn-ghost btn-sm" disabled={busy || !!assetBusy} onClick={() => handleToggleAsset(a)} style={{ padding: '3px 7px', fontSize: '0.58rem' }}>
                                                    {busy && assetBusy?.action === 'toggle' ? '…' : (a.is_active === 1 ? 'Deactivate' : 'Activate')}
                                                </button>
                                                <button className="btn btn-ghost btn-sm" disabled={busy || !!assetBusy} onClick={() => handleDeleteAsset(a)} style={{ padding: '3px 7px', fontSize: '0.58rem', color: 'var(--red-status)', borderColor: 'rgba(239,68,68,0.3)' }}>
                                                    {busy && assetBusy?.action === 'delete' ? '…' : 'Delete'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </motion.div>

                {/* ── Add/Edit gift form ── */}
                {showForm && (
                    <motion.div variants={fadeUp} initial="hidden" animate="show" className="card" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-6)' }}>
                        <h2 style={{ margin: '0 0 var(--space-4)', fontSize: '1.125rem', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                            {editingId ? 'Edit Gift' : 'Add Gift'}
                        </h2>
                        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                            {/* Gift Asset picker */}
                            <div>
                                <label style={labelStyle}>Gift Asset</label>
                                {assets.length === 0 ? (
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '0 0 8px' }}>No assets yet — add one in the Asset Library above.</p>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 8 }}>
                                        {assets.map(a => {
                                            const selected = assetId === a.id;
                                            return (
                                                <button
                                                    key={a.id}
                                                    type="button"
                                                    onClick={() => setAssetId(a.id)}
                                                    style={{
                                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer',
                                                        padding: '8px 6px', borderRadius: 'var(--radius-md)',
                                                        background: selected ? 'rgba(59,130,246,0.1)' : 'var(--bg-input)',
                                                        border: selected ? '2px solid var(--blue-vivid)' : '1px solid var(--border-subtle)',
                                                    }}
                                                >
                                                    <div style={{ width: 44, height: 44 }}>{assetThumb(a)}</div>
                                                    <span style={{ fontSize: '0.58rem', color: selected ? 'var(--blue-vivid)' : 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{a.name}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                                {assetId != null && (() => {
                                    const sel = assets.find(a => a.id === assetId);
                                    return sel ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 8 }}>
                                            <div style={{ width: 40, height: 40, borderRadius: 8, overflow: 'hidden', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>{assetThumb(sel)}</div>
                                            <span style={{ fontSize: '0.78rem', color: 'var(--green-status)', fontWeight: 700 }}>Selected: {sel.name}</span>
                                        </div>
                                    ) : null;
                                })()}
                            </div>

                            <div>
                                <label style={labelStyle}>Name</label>
                                <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Rose" />
                            </div>
                            <div>
                                <label style={labelStyle}>Price</label>
                                <input style={inputStyle} type="number" min="0.01" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="10" />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                                <div>
                                    <label style={labelStyle}>Provider %</label>
                                    <input style={inputStyle} type="number" min="0" max="100" value={form.provider_percentage} onChange={e => setForm(f => ({ ...f, provider_percentage: e.target.value }))} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Admin %</label>
                                    <input style={inputStyle} type="number" min="0" max="100" value={form.admin_percentage} onChange={e => setForm(f => ({ ...f, admin_percentage: e.target.value }))} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)' }}>
                                <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
                                <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={submitting}>
                                    {submitting ? 'Saving…' : 'Save'}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* ── Gift list ── */}
                {loading ? (
                    <motion.div variants={fadeUp} initial="hidden" animate="show" className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
                        <div className="spinner" style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--border-subtle)', borderTop: '3px solid var(--gold-mid)', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>Loading gifts...</p>
                    </motion.div>
                ) : gifts.length === 0 ? (
                    <motion.div variants={fadeUp} initial="hidden" animate="show" className="card" style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No gifts yet. Click "+ Add Gift" to create one.
                    </motion.div>
                ) : (
                    <motion.div variants={fadeUp} initial="hidden" animate="show" className="card" style={{ padding: 'var(--space-5)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {gifts.map(g => (
                                <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) 0', borderBottom: '1px solid var(--border-subtle)' }}>
                                    <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-lg)', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                                        {giftVisual(g)}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                            <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.9rem' }}>{g.name}</span>
                                            <span className="badge" style={g.is_active === 1 ? { background: 'rgba(16,185,129,0.12)', color: 'var(--green-status)', borderColor: 'rgba(16,185,129,0.35)' } : { background: 'rgba(148,163,184,0.12)', color: '#94a3b8', borderColor: 'rgba(148,163,184,0.3)' }}>
                                                {g.is_active === 1 ? 'Active' : 'Inactive'}
                                            </span>
                                            {g.asset?.name && (
                                                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: "'Inter', sans-serif" }}>asset: {g.asset.name}</span>
                                            )}
                                        </div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 2 }}>
                                            <PointsDisplay amount={g.price} decimals={2} /> · Provider {Number(g.provider_percentage).toFixed(0)}% / Admin {Number(g.admin_percentage).toFixed(0)}%
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
                                        <button className="btn btn-ghost btn-sm" onClick={() => startEdit(g)} style={{ padding: '6px 12px' }}>Edit</button>
                                        {g.is_active === 1 ? (
                                            <button className="btn btn-ghost btn-sm" onClick={() => handleToggle(g)} disabled={togglingId !== null} style={{ padding: '6px 12px', color: '#f59e0b', borderColor: 'rgba(245,158,11,0.4)' }}>
                                                {togglingId === g.id ? <MiniSpinner color="#f59e0b" /> : 'Deactivate'}
                                            </button>
                                        ) : (
                                            <button className="btn btn-primary btn-sm" onClick={() => handleToggle(g)} disabled={togglingId !== null} style={{ padding: '6px 12px' }}>
                                                {togglingId === g.id ? <MiniSpinner color="#0a0a0a" /> : 'Activate'}
                                            </button>
                                        )}
                                        <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(g)} style={{ padding: '6px 12px', color: 'var(--red-status)', borderColor: 'rgba(239,68,68,0.3)' }}>Delete</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </>
    );
}

export default AdminGiftPage;