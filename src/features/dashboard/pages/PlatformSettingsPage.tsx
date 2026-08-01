import { useEffect, useState } from 'react';
import { TopNav } from './TopNav';
import { adminApi } from '../../../utils/api';
import { useToast } from '../../../components/Toast';

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

    return (
        <>
            <style>{`@keyframes fadeInPage{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
            <TopNav />
            <div style={{
                maxWidth: 480,
                margin: '0 auto',
                padding: '20px 16px',
                animation: 'fadeInPage .3s ease',
            }}>
                <h1 style={{
                    color: '#fff',
                    fontSize: '1.4rem',
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                    margin: '0 0 20px',
                }}>
                    Platform Settings
                </h1>

                <div style={{
                    background: 'var(--bg-card, rgba(255,255,255,0.04))',
                    border: '1px solid var(--border-default, rgba(255,255,255,0.1))',
                    borderRadius: 16,
                    padding: '20px 18px',
                }}>
                    <h2 style={{
                        color: '#fff',
                        fontSize: '1rem',
                        fontWeight: 700,
                        margin: '0 0 4px',
                    }}>
                        Audio Call Rate
                    </h2>
                    <p style={{
                        color: 'rgba(255,255,255,0.35)',
                        fontSize: '0.75rem',
                        margin: '0 0 16px',
                    }}>
                        Cost per minute charged to both user and provider (split equally).
                    </p>

                    <label style={{
                        display: 'block',
                        fontSize: '0.6rem',
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        color: 'rgba(255,255,255,0.4)',
                        fontWeight: 700,
                        marginBottom: 6,
                    }}>
                        Call Rate Per Minute
                    </label>

                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1rem', fontWeight: 600 }}>$</span>
                        <input
                            type="number"
                            min="0.01"
                            max="1000"
                            step="0.01"
                            value={rate}
                            onChange={e => handleRateChange(e.target.value)}
                            disabled={loading}
                            placeholder="2.00"
                            style={{
                                flex: 1,
                                background: 'var(--bg-input, rgba(255,255,255,0.06))',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 10,
                                padding: '11px 14px',
                                color: '#fff',
                                fontSize: '1rem',
                                fontWeight: 600,
                                fontFamily: "'Inter',sans-serif",
                                outline: 'none',
                                boxSizing: 'border-box',
                            }}
                        />
                        <button
                            onClick={handleSave}
                            disabled={loading || saving}
                            style={{
                                padding: '11px 22px',
                                borderRadius: 10,
                                border: 'none',
                                background: saving ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                                color: '#fff',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                cursor: saving || loading ? 'default' : 'pointer',
                                fontFamily: "'Inter',sans-serif",
                                transition: 'opacity .15s',
                            }}>
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                    </div>

                    <label style={{
                        display: 'block',
                        fontSize: '0.6rem',
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        color: 'rgba(255,255,255,0.4)',
                        fontWeight: 700,
                        marginBottom: 6,
                    }}>
                        Call Rate Per Second
                    </label>
                    <div style={{
                        display: 'flex',
                        gap: 10,
                        alignItems: 'center',
                    }}>
                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1rem', fontWeight: 600 }}>$</span>
                        <input
                            type="text"
                            value={ratePerSecond}
                            readOnly
                            disabled
                            title="Auto-calculated from the minute rate"
                            style={{
                                flex: 1,
                                background: 'var(--bg-input, rgba(255,255,255,0.03))',
                                border: '1px dashed rgba(255,255,255,0.08)',
                                borderRadius: 10,
                                padding: '11px 14px',
                                color: 'rgba(255,255,255,0.45)',
                                fontSize: '1rem',
                                fontWeight: 600,
                                fontFamily: "'Inter',sans-serif",
                                outline: 'none',
                                boxSizing: 'border-box',
                                cursor: 'not-allowed',
                            }}
                        />
                        <span style={{
                            fontSize: '0.65rem',
                            color: 'rgba(255,255,255,0.25)',
                            whiteSpace: 'nowrap',
                        }}>
                            auto
                        </span>
                    </div>
                </div>
            </div>
        </>
    );
}
