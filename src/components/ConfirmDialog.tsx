/* eslint-disable react-refresh/only-export-components */
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from 'react';

type Variant = 'danger' | 'warning' | 'primary';

export interface ConfirmOptions {
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: Variant;
}

interface ConfirmState extends ConfirmOptions {
    resolve: (value: boolean) => void;
}

type ConfirmDialogFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmDialogFn | null>(null);

const CONFIRM_BG: Record<Variant, string> = {
    danger: 'linear-gradient(135deg,#ef4444,#dc2626)',
    warning: 'linear-gradient(135deg,#f59e0b,#d97706)',
    primary: 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
};

export function ConfirmProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<ConfirmState | null>(null);
    const [busy, setBusy] = useState(false);
    const triggerRef = useRef<HTMLElement | null>(null);
    const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

    const confirmDialog = useCallback<ConfirmDialogFn>((options) => {
        triggerRef.current = document.activeElement as HTMLElement | null;
        setBusy(false);
        return new Promise<boolean>((resolve) => {
            setState({ ...options, resolve });
        });
    }, []);

    const close = useCallback((result: boolean) => {
        setState((s) => {
            if (s) s.resolve(result);
            return null;
        });
        requestAnimationFrame(() => {
            if (triggerRef.current && typeof triggerRef.current.focus === 'function') {
                triggerRef.current.focus();
            }
        });
    }, []);

    // Escape closes (cancels); focus the confirm action on open; lock body scroll.
    useEffect(() => {
        if (!state) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close(false);
        };
        window.addEventListener('keydown', onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const focusTimer = window.setTimeout(() => confirmButtonRef.current?.focus(), 20);
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
            window.clearTimeout(focusTimer);
        };
    }, [state, close]);

    const variant: Variant = state?.variant ?? 'primary';

    return (
        <ConfirmContext.Provider value={confirmDialog}>
            {children}
            {state && (
                <div
                    role="alertdialog"
                    aria-modal="true"
                    aria-label={state.title}
                    onClick={() => { if (!busy) close(false); }}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 900,
                        background: 'var(--bg-overlay, rgba(3,7,15,0.72))',
                        backdropFilter: 'blur(6px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 20,
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        role="document"
                        style={{
                            width: '100%',
                            maxWidth: 360,
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 16,
                            boxShadow: 'var(--shadow-lg)',
                            boxSizing: 'border-box',
                            padding: '20px 20px 16px',
                            fontFamily: "'Inter', sans-serif",
                            animation: 'vserv-toast-in 0.18s ease',
                        }}
                    >
                        <p style={{ margin: '0 0 6px', fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {state.title}
                        </p>
                        {state.message && (
                            <p style={{ margin: '0 0 18px', fontSize: '0.82rem', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                                {state.message}
                            </p>
                        )}
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                onClick={() => close(false)}
                                disabled={busy}
                                style={{
                                    padding: '9px 16px',
                                    borderRadius: 8,
                                    border: '1px solid var(--border-subtle)',
                                    background: 'transparent',
                                    color: 'var(--text-secondary)',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    cursor: busy ? 'not-allowed' : 'pointer',
                                    opacity: busy ? 0.6 : 1,
                                }}
                            >
                                {state.cancelLabel ?? 'Cancel'}
                            </button>
                            <button
                                ref={confirmButtonRef}
                                type="button"
                                onClick={() => { setBusy(true); close(true); }}
                                disabled={busy}
                                style={{
                                    padding: '9px 16px',
                                    borderRadius: 8,
                                    border: 'none',
                                    background: CONFIRM_BG[variant],
                                    color: '#fff',
                                    fontSize: '0.72rem',
                                    fontWeight: 800,
                                    cursor: busy ? 'not-allowed' : 'pointer',
                                    opacity: busy ? 0.6 : 1,
                                    boxShadow: variant === 'danger' ? '0 0 14px rgba(239,68,68,0.35)' : undefined,
                                }}
                            >
                                {state.confirmLabel ?? 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    );
}

export function useConfirmDialog(): ConfirmDialogFn {
    const ctx = useContext(ConfirmContext);
    if (!ctx) throw new Error('useConfirmDialog must be used within a <ConfirmProvider>');
    return ctx;
}

export default ConfirmProvider;