import { useEffect, useState } from 'react';
import { paymentMethodApi, type DepositPaymentMethod } from '../utils/api';
import bkashLogo from '../assets/bikash-logo.png';
import nagadLogo from '../assets/Nagad-Logo.png';

const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.6rem',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    fontWeight: 700,
    fontFamily: "'Inter', sans-serif",
    marginBottom: '8px',
};

function MethodCard({
    name,
    logo,
    available,
    selected,
    onPick,
}: {
    name: string;
    logo: string;
    available: boolean;
    selected: boolean;
    onPick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={available ? onPick : undefined}
            disabled={!available}
            aria-pressed={selected}
            style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                padding: '12px 8px', cursor: available ? 'pointer' : 'not-allowed',
                borderRadius: 12,
                background: selected ? 'rgba(197,168,128,0.14)' : 'var(--bg-input)',
                border: selected ? '2px solid var(--gold-mid)' : '1px solid var(--border-subtle)',
                opacity: available ? 1 : 0.45,
                boxSizing: 'border-box',
                transition: 'all 0.18s',
            }}
            onMouseEnter={(e) => { if (available) e.currentTarget.style.borderColor = 'var(--gold-mid)'; }}
            onMouseLeave={(e) => { if (!selected) e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
        >
            <span style={{ width: 34, height: 34, borderRadius: 8, overflow: 'hidden', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={logo} alt={name} style={{ width: 30, height: 30, objectFit: 'contain' }} />
            </span>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: selected ? 'var(--gold-mid)' : 'var(--text-primary)', fontFamily: "'Inter', sans-serif" }}>{name}</span>
        </button>
    );
}

/**
 * Dynamic bKash/Nagad deposit method selector for the User/Provider deposit
 * modal. Reads ACTIVE methods from the backend — never hardcodes numbers.
 * Selecting a method reports the full configured row to the parent form.
 */
export function DepositMethodSelector({ onSelect }: { onSelect: (method: DepositPaymentMethod | null) => void }) {
    const [methods, setMethods] = useState<DepositPaymentMethod[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<DepositPaymentMethod | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const res = await paymentMethodApi.getActive();
            if (cancelled) return;
            setMethods(res.error ? [] : res.data?.methods ?? []);
            setLoading(false);
        })();
        return () => { cancelled = true; };
    }, []);

    const activeFor = (method: 'bkash' | 'nagad') =>
        methods.find((m) => m.method === method && m.is_active === 1) ?? null;

    const pick = (m: DepositPaymentMethod) => {
        setSelected(m);
        onSelect(m);
    };

    const bkash = activeFor('bkash');
    const nagad = activeFor('nagad');

    return (
        <div>
            <label style={labelStyle}>Select Payment Method</label>

            {loading ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>Loading payment methods…</p>
            ) : methods.length === 0 ? (
                <p style={{ color: 'var(--gold-mid)', fontSize: '0.85rem', fontWeight: 600, margin: 0 }}>
                    Deposit payment method is currently unavailable.
                </p>
            ) : (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <MethodCard
                            name="bKash"
                            logo={bkashLogo}
                            available={!!bkash}
                            selected={selected?.method === 'bkash'}
                            onPick={() => bkash && pick(bkash)}
                        />
                        <MethodCard
                            name="Nagad"
                            logo={nagadLogo}
                            available={!!nagad}
                            selected={selected?.method === 'nagad'}
                            onPick={() => nagad && pick(nagad)}
                        />
                    </div>

                    {selected && (
                        <div style={{
                            marginTop: 12, padding: '12px 14px', borderRadius: 10,
                            background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
                            fontFamily: "'Inter', sans-serif", fontSize: '0.8rem', color: 'var(--text-primary)',
                        }}>
                            <div style={{ fontWeight: 700, color: 'var(--gold-mid)', marginBottom: 6 }}>
                                Selected: {selected.method === 'bkash' ? 'bKash' : 'Nagad'}
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>Send money to:</span>
                                <span style={{ fontWeight: 800 }}>{selected.account_number}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                                <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>Account type:</span>
                                <span style={{ fontWeight: 700 }}>{selected.account_type === 'agent' ? 'Agent' : 'Personal'}</span>
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: 6 }}>
                                After payment, enter the Transaction ID below and upload your payment screenshot.
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default DepositMethodSelector;