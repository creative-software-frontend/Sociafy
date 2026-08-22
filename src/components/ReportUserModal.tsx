import { useEffect, useState } from 'react';
import { reportApi } from '../utils/api';
import { useToast } from './Toast';

interface ReportUserModalProps {
    open: boolean;
    reportedUserId: number;
    reportedUserName: string;
    onClose: () => void;
}

export function ReportUserModal({ open, reportedUserId, reportedUserName, onClose }: ReportUserModalProps) {
    const toast = useToast();
    const [reasons, setReasons] = useState<Array<{ id: number; name: string; description: string | null }>>([]);
    const [reasonId, setReasonId] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setReasonId('');
        setDescription('');
        setLoading(true);
        reportApi.getReasons().then((res) => {
            if (cancelled) return;
            if (res.error) toast.error(res.error);
            else setReasons(res.data?.reasons ?? []);
            setLoading(false);
        });
        return () => { cancelled = true; };
    }, [open, toast]);

    if (!open) return null;

    const submit = async () => {
        if (!reasonId) {
            toast.error('Select a reason for this report.');
            return;
        }
        setSubmitting(true);
        const res = await reportApi.createReport({
            reported_user_id: reportedUserId,
            reason_id: Number(reasonId),
            description: description.trim() || undefined,
        });
        setSubmitting(false);
        if (res.error) {
            toast.error(res.error);
            return;
        }
        toast.success('Your report was submitted for review.');
        onClose();
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-user-title"
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'var(--bg-overlay)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
            <div
                onClick={(event) => event.stopPropagation()}
                style={{ width: '100%', maxWidth: 420, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 16, boxShadow: 'var(--shadow-lg)', padding: 20 }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                    <span aria-hidden="true" style={{ color: 'var(--red-status)', fontSize: 20 }}>!</span>
                    <h2 id="report-user-title" style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 800 }}>Report {reportedUserName}</h2>
                </div>
                <p style={{ margin: '0 0 18px', color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.5 }}>Choose the reason that best describes the issue.</p>

                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 800, marginBottom: 7 }} htmlFor="report-reason">Reason</label>
                <select
                    id="report-reason"
                    value={reasonId}
                    onChange={(event) => setReasonId(event.target.value)}
                    disabled={loading || submitting}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px', borderRadius: 9, border: '1px solid var(--border-subtle)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '0.82rem', marginBottom: 14 }}
                >
                    <option value="">{loading ? 'Loading reasons...' : 'Select a reason'}</option>
                    {reasons.map((reason) => <option key={reason.id} value={reason.id}>{reason.name}</option>)}
                </select>

                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 800, marginBottom: 7 }} htmlFor="report-details">Additional details <span style={{ fontWeight: 500 }}>(optional)</span></label>
                <textarea
                    id="report-details"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    disabled={submitting}
                    maxLength={2000}
                    rows={4}
                    placeholder="Add context for the moderation team"
                    style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: '11px 12px', borderRadius: 9, border: '1px solid var(--border-subtle)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '0.82rem', fontFamily: 'inherit', marginBottom: 18 }}
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button type="button" onClick={onClose} disabled={submitting} style={{ padding: '10px 15px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}>Cancel</button>
                    <button type="button" onClick={submit} disabled={loading || submitting || !reasons.length} style={{ padding: '10px 15px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#ef4444,#dc2626)', color: '#fff', fontWeight: 800, cursor: loading || submitting || !reasons.length ? 'not-allowed' : 'pointer', opacity: loading || submitting || !reasons.length ? 0.6 : 1 }}>{submitting ? 'Submitting...' : 'Submit report'}</button>
                </div>
            </div>
        </div>
    );
}
