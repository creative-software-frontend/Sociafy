import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TopNav } from './TopNav';
import { adminApi } from '../../../utils/api';
import { useToast } from '../../../components/Toast';
import { PointsIcon } from '../../../components/PointsDisplay';

const fadeUp = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const SettingsIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
);

export function PlatformSettingsPage() {
    const toast = useToast();
    const [rate, setRate] = useState('');
    const [ratePerSecond, setRatePerSecond] = useState('0.000000');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        (async () => {
            setLoading(true);
            const res = await adminApi.getPlatformSettings();
            if (!res.error && res.data) {
                setRate(String(res.data.call_rate_per_minute));
                setRatePerSecond(String(res.data.call_rate_per_second));
            }
            setLoading(false);
        })();
    }, []);

    const handleRateChange = (value: string) => {
        setRate(value);
        const n = Number(value);
        if (Number.isFinite(n) && n > 0) {
            const sec = Math.round((n / 60) * 1000000) / 1000000;
            setRatePerSecond(String(sec));
        }
    };

    const handleSave = async () => {
        const value = Number(rate);
        if (!Number.isFinite(value) || value <= 0) {
            toast.error('Rate must be greater than 0');
            return;
        }
        if (value > 1000) {
            toast.error('Rate cannot exceed 1000');
            return;
        }
        setSaving(true);
        const res = await adminApi.updatePlatformSettings(value);
        setSaving(false);
        if (!res.error && res.data) {
            setRate(String(res.data.call_rate_per_minute));
            setRatePerSecond(String(res.data.call_rate_per_second));
            toast.success('Call rate updated successfully.');
        } else {
            toast.error(res.error || 'Failed to update call rate');
        }
    };

    const inputStyle: React.CSSProperties = {
        width: '100%',
        background: 'var(--bg-input)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 14px',
        color: 'var(--text-primary)',
        fontSize: '1rem',
        fontWeight: 600,
        fontFamily: "'Inter', sans-serif",
        outline: 'none',
        boxSizing: 'border-box',
        transition: 'border-color 0.2s',
    };

    return (
        <>
            <TopNav />
            <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 40px' }}>
                {/* Page header */}
                <motion.div variants={fadeUp} initial="hidden" animate="show" style={{ marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, var(--gold-deep), var(--gold-mid))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-gold)', flexShrink: 0 }}>
                        <SettingsIcon />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>Platform Settings</h1>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Configure audio call pricing</p>
                    </div>
                </motion.div>

                {loading ? (
                    <motion.div variants={fadeUp} initial="hidden" animate="show" className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
                        <div className="spinner" style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--border-subtle)', borderTop: '3px solid var(--gold-mid)', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>Loading settings...</p>
                    </motion.div>
                ) : (
                    <motion.div variants={fadeUp} initial="hidden" animate="show" className="card" style={{ padding: 'var(--space-6)' }}>
                        {/* Call Rate Per Minute */}
                        <label className="eyebrow" style={{ display: 'block', marginBottom: 'var(--space-1)' }}>Call Rate Per Minute</label>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '0 0 var(--space-4)' }}>
                            Cost per minute charged to both user &amp; provider (split equally).
                        </p>

                        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '1rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}><PointsIcon /></span>
                            <input
                                type="number"
                                min="0.01"
                                max="1000"
                                step="0.01"
                                value={rate}
                                onChange={e => handleRateChange(e.target.value)}
                                placeholder="2.00"
                                style={inputStyle}
                            />
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="btn btn-primary"
                                style={{ whiteSpace: 'nowrap' }}
                            >
                                {saving ? 'Saving…' : 'Save'}
                            </button>
                        </div>

                        {/* Call Rate Per Second (read-only) */}
                        <label className="eyebrow" style={{ display: 'block', marginBottom: 'var(--space-1)' }}>Call Rate Per Second</label>
                        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '1rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}><PointsIcon /></span>
                            <div style={{
                                flex: 1,
                                background: 'var(--bg-input)',
                                border: '1px dashed var(--border-default)',
                                borderRadius: 'var(--radius-md)',
                                padding: '12px 14px',
                                color: 'var(--gold-mid)',
                                fontSize: '1rem',
                                fontWeight: 700,
                                fontFamily: "'Inter', sans-serif",
                            }}>
                                {ratePerSecond}
                            </div>
                            <span className="badge badge-gold" style={{ whiteSpace: 'nowrap' }}>Auto</span>
                        </div>
                    </motion.div>
                )}
            </div>
        </>
    );
}
