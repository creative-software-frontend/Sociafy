import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { paymentMethodApi, type DepositPaymentMethod } from '../../../utils/api';
import { useToast } from '../../../components/Toast';
import { useConfirmDialog } from '../../../components/ConfirmDialog';
import bkashLogo from '../../../assets/bikash-logo.png';
import nagadLogo from '../../../assets/Nagad-Logo.png';

const fadeUp = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.6rem',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    fontWeight: 700,
    fontFamily: "'Inter', sans-serif",
    marginBottom: '6px',
};

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
};

const typeLabel = (t: string) => (t === 'agent' ? 'Agent' : 'Personal');
const methodName = (m: string) => (m === 'bkash' ? 'bKash' : 'Nagad');

export function DepositPaymentMethodsSection() {
    const toast = useToast();
    const confirmDialog = useConfirmDialog();

    const [methods, setMethods] = useState<DepositPaymentMethod[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<number | null>(null);

    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<DepositPaymentMethod | null>(null);
    const [formMethod, setFormMethod] = useState<'bkash' | 'nagad'>('bkash');
    const [formNumber, setFormNumber] = useState('');
    const [formType, setFormType] = useState<'personal' | 'agent'>('personal');
    const [saving, setSaving] = useState(false);

    const load = async () => {
        const res = await paymentMethodApi.getAll();
        if (!res.error && res.data) setMethods(res.data.methods);
        setLoading(false);
    };

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const res = await paymentMethodApi.getAll();
            if (!cancelled && !res.error && res.data) setMethods(res.data.methods);
            if (!cancelled) setLoading(false);
        })();
        return () => { cancelled = true; };
    }, []);

    const openAdd = (m: 'bkash' | 'nagad') => {
        setEditing(null);
        setFormMethod(m);
        setFormNumber('');
        setFormType('personal');
        setShowForm(true);
    };

    const openEdit = (m: DepositPaymentMethod) => {
        setEditing(m);
        setFormMethod(m.method);
        setFormNumber(m.account_number);
        setFormType(m.account_type);
        setShowForm(true);
    };

    const handleSave = async () => {
        const num = formNumber.replace(/\D/g, '');
        if (!num || !/^01[3-9][0-9]{8}$/.test(num)) {
            toast.error('Enter a valid Bangladesh mobile number (01XXXXXXXXX)');
            return;
        }
        setSaving(true);
        const res = editing
            ? await paymentMethodApi.update(editing.id, { account_number: num, account_type: formType })
            : await paymentMethodApi.create({ method: formMethod, account_number: num, account_type: formType, is_active: true });
        setSaving(false);
        if (res.error) {
            toast.error(res.error);
            return;
        }
        toast.success(editing ? 'Payment method updated.' : 'Payment method added.');
        setShowForm(false);
        await load();
    };

    const handleToggle = async (m: DepositPaymentMethod) => {
        const activating = m.is_active !== 1;
        if (!activating) {
            const ok = await confirmDialog({
                title: `Disable ${methodName(m.method)}?`,
                message: 'Users and providers will no longer see this payment method for deposits.',
                confirmLabel: 'Disable',
                variant: 'danger',
            });
            if (!ok) return;
        }
        setBusyId(m.id);
        const res = await paymentMethodApi.toggle(m.id, activating);
        setBusyId(null);
        if (res.error) {
            toast.error(res.error);
            return;
        }
        toast.success(activating ? 'Payment method enabled.' : 'Payment method disabled.');
        await load();
    };

    const logo = (m: string) => (m === 'bkash' ? bkashLogo : nagadLogo);

    return (
        <>
            <motion.div variants={fadeUp} initial="hidden" animate="show" className="card gold-top-edge" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-6)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
                    <div style={{ minWidth: 0 }}>
                        <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                            Deposit Payment Methods
                        </h2>
                        <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            bKash / Nagad numbers shown to users &amp; providers when depositing.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
                        <button className="btn btn-primary btn-sm" onClick={() => openAdd('bkash')}>+ Add bKash</button>
                        <button className="btn btn-outline btn-sm" onClick={() => openAdd('nagad')}>+ Add Nagad</button>
                    </div>
                </div>

                {loading ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>Loading payment methods…</p>
                ) : methods.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        No payment methods configured yet. Add a bKash or Nagad account to show users where to send deposits.
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                        {methods.map((m) => {
                            const active = m.is_active === 1;
                            const busy = busyId === m.id;
                            return (
                                <div key={m.id} style={{
                                    display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap',
                                    padding: '12px 14px', borderRadius: 'var(--radius-md)',
                                    background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
                                }}>
                                    <div style={{ width: 36, height: 36, borderRadius: 8, overflow: 'hidden', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <img src={logo(m.method)} alt={methodName(m.method)} style={{ width: 30, height: 30, objectFit: 'contain' }} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 140 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{methodName(m.method)}</span>
                                            <span className="badge" style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8', borderColor: 'rgba(99,102,241,0.3)' }}>{typeLabel(m.account_type)}</span>
                                            <span className="badge" style={active
                                                ? { background: 'rgba(16,185,129,0.12)', color: 'var(--green-status)', borderColor: 'rgba(16,185,129,0.35)' }
                                                : { background: 'rgba(148,163,184,0.12)', color: '#94a3b8', borderColor: 'rgba(148,163,184,0.3)' }}>
                                                {active ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: 3 }}>{m.account_number}</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
                                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(m)} style={{ padding: '6px 12px' }}>Edit</button>
                                        {active ? (
                                            <button className="btn btn-ghost btn-sm" onClick={() => handleToggle(m)} disabled={busy || busyId !== null} style={{ padding: '6px 12px', color: '#f59e0b', borderColor: 'rgba(245,158,11,0.4)' }}>
                                                {busy ? '…' : 'Disable'}
                                            </button>
                                        ) : (
                                            <button className="btn btn-primary btn-sm" onClick={() => handleToggle(m)} disabled={busy || busyId !== null} style={{ padding: '6px 12px' }}>
                                                {busy ? '…' : 'Enable'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </motion.div>

            {/* Add / Edit form modal */}
            {showForm && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label={editing ? 'Edit payment method' : 'Add payment method'}
                    onClick={() => { if (!saving) setShowForm(false); }}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 800,
                        background: 'var(--bg-overlay)', backdropFilter: 'blur(6px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: '100%', maxWidth: 380, background: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)', borderRadius: 16,
                            boxShadow: 'var(--shadow-lg)', boxSizing: 'border-box', padding: '22px 20px',
                            fontFamily: "'Inter', sans-serif", animation: 'vserv-toast-in 0.18s ease',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, overflow: 'hidden', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <img src={logo(formMethod)} alt={methodName(formMethod)} style={{ width: 26, height: 26, objectFit: 'contain' }} />
                            </div>
                            <p style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                {editing ? 'Edit' : 'Add'} {methodName(formMethod)} Account
                            </p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div>
                                <label style={labelStyle}>Account number *</label>
                                <input
                                    style={inputStyle}
                                    inputMode="numeric"
                                    value={formNumber}
                                    onChange={(e) => setFormNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
                                    placeholder="01XXXXXXXXX"
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Account type</label>
                                <select
                                    style={{ ...inputStyle, cursor: 'pointer' }}
                                    value={formType}
                                    onChange={(e) => setFormType(e.target.value as 'personal' | 'agent')}
                                >
                                    <option value="personal">Personal</option>
                                    <option value="agent">Agent</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
                                <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)} disabled={saving}>
                                    Cancel
                                </button>
                                <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                                    {saving ? 'Saving…' : 'Save'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default DepositPaymentMethodsSection;