import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../components/Toast';
import { adminAuthApi } from '../../../utils/api';

/**
 * Admin-only self-deletion section.
 *
 * Shows only when the current user is an administrator. Requires the current
 * password plus an explicit confirmation checkbox, and the destructive action
 * is gated behind a confirmation modal so it can never be triggered by a
 * single accidental click.
 *
 * On success: clears the session/auth state, redirects to /admin/setup (which
 * becomes available again because no admin exists), and shows a success toast.
 * On failure the admin stays signed in and the server error is shown inline.
 */
export function AdminAccountDeletionSection() {
    const navigate = useNavigate();
    const { logout } = useAuth();
    const toast = useToast();

    const [password, setPassword] = useState('');
    const [confirmed, setConfirmed] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset the in-flight state whenever the modal is (re)opened.
    useEffect(() => {
        if (modalOpen) setDeleting(false);
    }, [modalOpen]);

    // Close on Escape (but not while a request is in flight).
    useEffect(() => {
        if (!modalOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !deleting) setModalOpen(false);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [modalOpen, deleting]);

    const openModal = () => {
        setError(null);
        if (!password) {
            setError('Enter your current password to continue.');
            return;
        }
        if (!confirmed) {
            setError('Please confirm that you understand the consequences before deleting your account.');
            return;
        }
        setModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (deleting) return;
        setDeleting(true);
        setError(null);
        try {
            const res = await adminAuthApi.deleteAccount(password);

            if (res.error || !res.data?.success) {
                // Keep the admin signed in and surface the server error.
                setError(res.error || res.data?.message || 'Unable to delete the administrator account.');
                setModalOpen(false);
                return;
            }

            // Success — clear the token/session and admin auth state, then
            // redirect to the now-available setup page.
            logout();
            setModalOpen(false);
            toast.success(
                res.data.message || 'Administrator account deleted. You can create a new administrator account.'
            );
            navigate('/admin/setup', { replace: true });
        } catch (err) {
            const message =
                err && typeof err === 'object' && 'message' in err
                    ? String((err as { message: unknown }).message)
                    : 'Something went wrong. Please try again.';
            setError(message);
            setModalOpen(false);
        } finally {
            setDeleting(false);
        }
    };

    const eyeIcon = (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    );

    return (
        <>
            <motion.div
                className="card"
                style={{
                    padding: '32px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                }}
            >
                <span
                    style={{
                        display: 'block',
                        fontSize: '0.7rem',
                        letterSpacing: '0.15em',
                        textTransform: 'uppercase',
                        color: 'var(--red-status)',
                        fontWeight: 700,
                        marginBottom: '4px',
                    }}
                >
                    Delete Administrator Account
                </span>

                <p
                    style={{
                        fontSize: '0.85rem',
                        lineHeight: 1.6,
                        color: 'var(--text-secondary)',
                        margin: 0,
                        fontFamily: "'Inter', sans-serif",
                    }}
                >
                    Deleting your administrator account will immediately sign you out. Because this
                    system allows only one administrator at a time, the administrator setup page
                    will become available again.
                </p>

                <div>
                    <label
                        htmlFor="admin-delete-password"
                        style={{
                            display: 'block',
                            fontSize: '0.6rem',
                            letterSpacing: '0.18em',
                            textTransform: 'uppercase',
                            color: 'var(--text-muted)',
                            fontFamily: "'Inter', sans-serif",
                            fontWeight: 700,
                            marginBottom: '8px',
                        }}
                    >
                        Current Password
                    </label>
                    <div style={{ position: 'relative' }}>
                        <input
                            id="admin-delete-password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Enter your current password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '12px 44px 12px 16px',
                                background: 'var(--bg-input)',
                                border: '1px solid var(--border-default)',
                                borderRadius: '8px',
                                color: 'var(--text-primary)',
                                fontSize: '0.875rem',
                                fontFamily: "'Inter', sans-serif",
                                outline: 'none',
                                transition: 'border-color 0.2s',
                                boxSizing: 'border-box',
                            }}
                            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--red-status)')}
                            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-default)')}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            style={{
                                position: 'absolute',
                                right: '14px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                            }}
                        >
                            {eyeIcon}
                        </button>
                    </div>
                </div>

                <label
                    htmlFor="admin-delete-confirm"
                    style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        fontSize: '0.82rem',
                        color: 'var(--text-secondary)',
                        fontFamily: "'Inter', sans-serif",
                        cursor: 'pointer',
                        lineHeight: 1.5,
                        position: 'relative',
                    }}
                >
                    <input
                        id="admin-delete-confirm"
                        type="checkbox"
                        checked={confirmed}
                        onChange={(e) => setConfirmed(e.target.checked)}
                        style={{
                            position: 'absolute',
                            opacity: 0,
                            width: 1,
                            height: 1,
                            overflow: 'hidden',
                            pointerEvents: 'none',
                        }}
                    />
                    <span
                        aria-hidden="true"
                        style={{
                            width: 18,
                            height: 18,
                            borderRadius: 5,
                            flexShrink: 0,
                            marginTop: 2,
                            border: `1.5px solid ${confirmed ? 'var(--red-status)' : 'var(--border-default)'}`,
                            background: confirmed ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s',
                            boxSizing: 'border-box',
                        }}
                    >
                        {confirmed && (
                            <svg
                                width="11"
                                height="11"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="var(--red-status)"
                                strokeWidth="3.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        )}
                    </span>
                    <span>
                        I understand that deleting my account is permanent, signs me out immediately, and
                        cannot be undone.
                    </span>
                </label>

                {error && (
                    <div
                        role="alert"
                        style={{
                            padding: '12px 16px',
                            borderRadius: '8px',
                            background: 'rgba(239, 68, 68, 0.08)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: 'var(--red-status)',
                            fontSize: '0.85rem',
                            fontFamily: "'Inter', sans-serif",
                        }}
                    >
                        {error}
                    </div>
                )}

                <button
                    id="admin-delete-open"
                    type="button"
                    onClick={openModal}
                    style={{
                        width: '100%',
                        padding: '14px',
                        background: 'linear-gradient(135deg, var(--red-status), #dc2626)',
                        border: 'none',
                        borderRadius: 10,
                        color: '#fff',
                        fontSize: '0.65rem',
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        fontWeight: 700,
                        fontFamily: "'Inter', sans-serif",
                        cursor: 'pointer',
                        boxShadow: '0 4px 20px rgba(239, 68, 68, 0.25)',
                        transition: 'filter 0.2s, transform 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.1)')}
                    onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
                >
                    Delete Administrator Account
                </button>
            </motion.div>

            <AnimatePresence>
                {modalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={() => {
                            if (!deleting) setModalOpen(false);
                        }}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            backgroundColor: 'var(--bg-overlay)',
                            backdropFilter: 'blur(8px)',
                            WebkitBackdropFilter: 'blur(8px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 99999,
                            padding: '20px',
                        }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
                            onClick={(e) => e.stopPropagation()}
                            className="card gold-top-edge"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="admin-delete-title"
                            style={{
                                width: '100%',
                                maxWidth: '440px',
                                position: 'relative',
                                boxSizing: 'border-box',
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    marginBottom: '14px',
                                    gap: '12px',
                                }}
                            >
                                <h3
                                    id="admin-delete-title"
                                    style={{
                                        fontSize: '1.25rem',
                                        fontWeight: 700,
                                        color: 'var(--text-primary)',
                                        margin: 0,
                                        fontFamily: "'Inter', sans-serif",
                                    }}
                                >
                                    Delete Administrator Account?
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    disabled={deleting}
                                    className="btn btn-ghost btn-sm"
                                    style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        padding: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                    }}
                                    aria-label="Close"
                                >
                                    ✕
                                </button>
                            </div>

                            <p
                                style={{
                                    fontSize: '0.88rem',
                                    lineHeight: 1.55,
                                    color: 'var(--text-secondary)',
                                    margin: '0 0 22px 0',
                                    fontFamily: "'Inter', sans-serif",
                                }}
                            >
                                This will permanently delete your administrator account and sign you
                                out. Since this system allows only one administrator at a time, the
                                administrator setup page will become available again and a new
                                administrator can be created. This action cannot be undone.
                            </p>

                            <div
                                style={{
                                    display: 'flex',
                                    gap: '12px',
                                    justifyContent: 'flex-end',
                                    flexWrap: 'wrap',
                                }}
                            >
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    disabled={deleting}
                                    className="btn btn-ghost btn-sm"
                                    style={{ minWidth: '110px' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    id="admin-delete-submit"
                                    type="button"
                                    onClick={handleConfirmDelete}
                                    disabled={deleting}
                                    className="btn btn-sm"
                                    style={{
                                        minWidth: '150px',
                                        color: '#fff',
                                        background: 'linear-gradient(135deg, var(--red-status), #dc2626)',
                                        borderColor: 'transparent',
                                        boxShadow: '0 4px 20px rgba(239, 68, 68, 0.25)',
                                        opacity: deleting ? 0.7 : 1,
                                        cursor: deleting ? 'not-allowed' : 'pointer',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!deleting) e.currentTarget.style.filter = 'brightness(1.1)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.filter = 'none';
                                    }}
                                >
                                    {deleting ? 'Deleting…' : 'Delete Account'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

export default AdminAccountDeletionSection;
