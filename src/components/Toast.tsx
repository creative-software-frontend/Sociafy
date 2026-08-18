/* eslint-disable react-refresh/only-export-components */
import {
    createContext,
    useCallback,
    useContext,
    useRef,
    useState,
    type ReactNode,
} from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
    id: number;
    type: ToastType;
    title?: string;
    message: string;
}

interface ToastContextValue {
    success: (message: string, title?: string) => void;
    error: (message: string, title?: string) => void;
    warning: (message: string, title?: string) => void;
    info: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastType, string> = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
};

const ACCENT: Record<ToastType, string> = {
    success: 'var(--green-status, #22c55e)',
    error: 'var(--red-status, #ef4444)',
    warning: 'var(--gold-mid, #f59e0b)',
    info: 'var(--blue-vivid, #3b82f6)',
};

const DURATION_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const nextId = useRef(1);

    const dismiss = useCallback((id: number) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const push = useCallback(
        (type: ToastType, message: string, title?: string) => {
            // Dedupe: identical toasts (same type/title/message) are not spammed.
            setToasts((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.type === type && last.title === title && last.message === message) {
                    return prev;
                }
                const t: ToastItem = { id: nextId.current++, type, title, message };
                window.setTimeout(() => dismiss(t.id), DURATION_MS);
                return [...prev, t];
            });
        },
        [dismiss]
    );

    const success = useCallback((m: string, t?: string) => push('success', m, t), [push]);
    const error = useCallback((m: string, t?: string) => push('error', m, t), [push]);
    const warning = useCallback((m: string, t?: string) => push('warning', m, t), [push]);
    const info = useCallback((m: string, t?: string) => push('info', m, t), [push]);

    return (
        <ToastContext.Provider value={{ success, error, warning, info }}>
            {children}
            <style>{`@keyframes vserv-toast-in{from{opacity:0;transform:translateY(-8px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes vserv-toast-progress{from{width:100%}to{width:0}}`}</style>
            <div
                aria-live="polite"
                style={{
                    position: 'fixed',
                    top: 20,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    zIndex: 3000,
                    pointerEvents: 'none',
                    width: 'min(92vw, 420px)',
                }}
            >
                {toasts.map((t) => (
                    <div
                        key={t.id}
                        role={t.type === 'error' ? 'alert' : 'status'}
                        aria-live={t.type === 'error' ? 'assertive' : 'polite'}
                        onClick={() => dismiss(t.id)}
                        style={{
                            pointerEvents: 'auto',
                            cursor: 'pointer',
                            position: 'relative',
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 10,
                            padding: '13px 16px',
                            borderRadius: 12,
                            background: 'rgba(10,15,30,0.97)',
                            border: `1px solid ${ACCENT[t.type]}`,
                            boxShadow: '0 8px 30px rgba(0,0,0,0.45)',
                            color: '#fff',
                            fontFamily: "'Inter', sans-serif",
                            animation: 'vserv-toast-in 0.22s ease',
                        }}
                    >
                        <span style={{ fontSize: 17, lineHeight: '20px', flexShrink: 0 }}>{ICONS[t.type]}</span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                            {t.title && (
                                <span style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.02em', marginBottom: 2 }}>
                                    {t.title}
                                </span>
                            )}
                            <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, lineHeight: 1.45 }}>{t.message}</span>
                        </span>
                        <span
                            role="presentation"
                            style={{
                                position: 'absolute',
                                left: 0,
                                bottom: 0,
                                height: 2,
                                background: ACCENT[t.type],
                                opacity: 0.6,
                                animation: 'vserv-toast-progress 4s linear forwards',
                            }}
                        />
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast(): ToastContextValue {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within a <ToastProvider>');
    return ctx;
}