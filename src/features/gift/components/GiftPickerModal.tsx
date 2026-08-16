import { useEffect, useState } from 'react';
import { giftApi } from '../services/giftApi';
import type { Gift } from '../types/gift';
import { PointsDisplay } from '../../../components/PointsDisplay';

interface Props {
    onClose: () => void;
    onSend: (gift: Gift) => void;
}

export function GiftPickerModal({ onClose, onSend }: Props) {
    const [gifts, setGifts] = useState<Gift[]>([]);
    const [loading, setLoading] = useState(true);
    const [confirmGift, setConfirmGift] = useState<Gift | null>(null);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        (async () => {
            const res = await giftApi.getGifts();
            if (!res.error && res.data) setGifts(res.data.gifts);
            setLoading(false);
        })();
    }, []);

    const handleConfirm = () => {
        if (!confirmGift || sending) return;
        setSending(true);
        onSend(confirmGift);
        setSending(false);
        setConfirmGift(null);
        onClose();
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10001,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(8px)',
            animation: 'fadeIn .2s ease',
        }}>
            <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes slideUp{from{transform:translateY(40px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>

            {/* Confirmation layer */}
            {confirmGift && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 10002,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.6)', padding: 24,
                }} onClick={e => { if (e.target === e.currentTarget) setConfirmGift(null); }}>
                    <div style={{
                        width: '100%', maxWidth: 320, background: '#0d1428',
                        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20,
                        padding: '28px 22px', textAlign: 'center',
                        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
                        animation: 'slideUp .25s ease',
                    }}>
                        <div style={{ fontSize: '3rem', marginBottom: 12 }}>{confirmGift.icon || '🎁'}</div>
                        <h3 style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 700, margin: '0 0 6px' }}>
                            Send {confirmGift.name}?
                        </h3>
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.95rem', margin: '0 0 22px' }}>
                            Send {confirmGift.name} for <PointsDisplay amount={confirmGift.price} decimals={2} />?
                        </p>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={() => setConfirmGift(null)} disabled={sending}
                                style={{
                                    flex: 1, padding: '12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)',
                                    background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)',
                                    fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif",
                                }}>
                                Cancel
                            </button>
                            <button onClick={handleConfirm} disabled={sending}
                                style={{
                                    flex: 1, padding: '12px', borderRadius: 12, border: 'none',
                                    background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff',
                                    fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter',sans-serif",
                                }}>
                                {sending ? 'Sending...' : 'Send'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom sheet */}
            <div style={{
                width: '100%',
                maxWidth: 480,
                background: '#0a1122',
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                border: '1px solid rgba(255,255,255,0.08)',
                padding: '20px 16px calc(20px + env(safe-area-inset-bottom))',
                animation: 'slideUp .3s ease',
                maxHeight: '72vh',
                display: 'flex',
                flexDirection: 'column',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h2 style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                        🎁 Send a Gift
                    </h2>
                    <button onClick={onClose}
                        style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 14 }}>
                        ✕
                    </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 10 }}>
                    {loading ? (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.3)' }}>Loading gifts...</div>
                    ) : gifts.length === 0 ? (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.3)' }}>No gifts available</div>
                    ) : (
                        gifts.map(g => (
                            <button key={g.id} onClick={() => setConfirmGift(g)}
                                style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                                    padding: '14px 8px', borderRadius: 14, cursor: 'pointer',
                                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                                    transition: 'all .15s', WebkitTapHighlightColor: 'transparent',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.12)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                            >
                                {g.image ? (
                                    <img src={g.image} alt={g.name} style={{ width: 44, height: 44, objectFit: 'contain' }} />
                                ) : (
                                    <span style={{ fontSize: '2rem', lineHeight: 1 }}>{g.icon || '🎁'}</span>
                                )}
                                <span style={{ color: '#fff', fontSize: '0.8rem', fontWeight: 600 }}>{g.name}</span>
                                <span style={{ color: 'rgba(139,92,246,0.9)', fontSize: '0.72rem', fontWeight: 700 }}><PointsDisplay amount={g.price} decimals={2} /></span>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
