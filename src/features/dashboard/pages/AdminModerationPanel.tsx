import { useEffect, useState } from 'react';
import { adminApi, type AdminUserReport, type ReportReason } from '../../../utils/api';
import { useToast } from '../../../components/Toast';

const buttonStyle = (color: string): React.CSSProperties => ({
    border: `1px solid ${color}66`, background: `${color}18`, color, borderRadius: 8,
    padding: '8px 11px', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer',
});

export default function AdminModerationPanel() {
    const toast = useToast();
    const [reports, setReports] = useState<AdminUserReport[]>([]);
    const [reasons, setReasons] = useState<Array<ReportReason & { is_active: number }>>([]);
    const [status, setStatus] = useState('');
    const [loading, setLoading] = useState(true);
    const [reasonName, setReasonName] = useState('');
    const [reasonDescription, setReasonDescription] = useState('');
    const [savingReason, setSavingReason] = useState(false);

    const load = async () => {
        setLoading(true);
        const [reportRes, reasonRes] = await Promise.all([adminApi.getUserReports(status || undefined), adminApi.getReportReasons()]);
        if (reportRes.error) toast.error(reportRes.error);
        else setReports(reportRes.data?.reports ?? []);
        if (reasonRes.error) toast.error(reasonRes.error);
        else setReasons((reasonRes.data?.reasons ?? []) as Array<ReportReason & { is_active: number }>);
        setLoading(false);
    };

    useEffect(() => { load(); }, [status]);

    const review = async (report: AdminUserReport, nextStatus: AdminUserReport['status']) => {
        const note = window.prompt('Optional moderation note', report.admin_note ?? '') ?? undefined;
        const res = await adminApi.reviewUserReport(report.id, nextStatus, note);
        if (res.error) toast.error(res.error);
        else { toast.success(`Report marked ${nextStatus.toLowerCase()}.`); await load(); }
    };

    const toggleReason = async (reason: ReportReason & { is_active: number }) => {
        const res = await adminApi.toggleReportReason(reason.id, reason.is_active !== 1);
        if (res.error) toast.error(res.error);
        else await load();
    };

    const addReason = async () => {
        if (!reasonName.trim()) return toast.error('Reason name is required.');
        setSavingReason(true);
        const res = await adminApi.createReportReason({ name: reasonName.trim(), description: reasonDescription.trim() || undefined });
        setSavingReason(false);
        if (res.error) toast.error(res.error);
        else { setReasonName(''); setReasonDescription(''); toast.success('Report reason created.'); await load(); }
    };

    const accountAction = async (report: AdminUserReport, active: boolean) => {
        const note = window.prompt(`${active ? 'Unban' : 'Ban'} note (optional)`) ?? undefined;
        const res = active ? await adminApi.unbanUser(report.reported_user_id, note) : await adminApi.banUser(report.reported_user_id, note);
        if (res.error) toast.error(res.error);
        else toast.success(`${report.reported_name} was ${active ? 'unbanned' : 'banned'}.`);
    };

    return (
        <section className="card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                <div>
                    <h2 style={{ margin: 0, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: '1.15rem' }}>User moderation</h2>
                    <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.76rem' }}>Review reports and manage active report reasons.</p>
                </div>
                <select value={status} onChange={(event) => setStatus(event.target.value)} style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '9px 11px', fontSize: '0.78rem' }}>
                    <option value="">All statuses</option><option value="Pending">Pending</option><option value="Reviewed">Reviewed</option><option value="Dismissed">Dismissed</option>
                </select>
            </div>

            {loading ? <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Loading moderation data...</p> : reports.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>No reports match this filter.</p> : (
                <div style={{ display: 'grid', gap: 10, marginBottom: 22 }}>
                    {reports.map((report) => (
                        <article key={report.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 13, background: 'var(--bg-input)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                                <strong style={{ color: 'var(--text-primary)', fontSize: '0.82rem' }}>{report.reported_name} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({report.reported_role})</span></strong>
                                <span className="badge" style={{ color: report.status === 'Pending' ? 'var(--gold-mid)' : report.status === 'Reviewed' ? 'var(--green-status)' : 'var(--text-muted)' }}>{report.status}</span>
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.76rem', marginTop: 6 }}>Reported by {report.reporter_name} ({report.reporter_role}) • {report.reason_name}</div>
                            {report.description && <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.45, margin: '7px 0' }}>{report.description}</p>}
                            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 9 }}>
                                {report.status === 'Pending' && <><button type="button" onClick={() => review(report, 'Reviewed')} style={buttonStyle('var(--green-status)')}>Mark reviewed</button><button type="button" onClick={() => review(report, 'Dismissed')} style={buttonStyle('var(--text-muted)')}>Dismiss</button></>}
                                <button type="button" onClick={() => accountAction(report, false)} style={buttonStyle('var(--red-status)')}>Ban account</button>
                                <button type="button" onClick={() => accountAction(report, true)} style={buttonStyle('var(--blue-vivid)')}>Unban account</button>
                            </div>
                        </article>
                    ))}
                </div>
            )}

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 18 }}>
                <h3 style={{ margin: '0 0 10px', color: 'var(--text-primary)', fontSize: '0.9rem' }}>Report reasons</h3>
                <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                    {reasons.map((reason) => <div key={reason.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 11px', border: '1px solid var(--border-subtle)', borderRadius: 8 }}><span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{reason.name}</span><button type="button" onClick={() => toggleReason(reason)} style={buttonStyle(reason.is_active === 1 ? 'var(--red-status)' : 'var(--green-status)')}>{reason.is_active === 1 ? 'Disable' : 'Enable'}</button></div>)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr auto', gap: 8, alignItems: 'center' }}>
                    <input value={reasonName} onChange={(event) => setReasonName(event.target.value)} placeholder="New reason" style={{ minWidth: 0, background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '9px 10px', fontSize: '0.78rem' }} />
                    <input value={reasonDescription} onChange={(event) => setReasonDescription(event.target.value)} placeholder="Description (optional)" style={{ minWidth: 0, background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '9px 10px', fontSize: '0.78rem' }} />
                    <button type="button" onClick={addReason} disabled={savingReason} style={buttonStyle('var(--gold-mid)')}>{savingReason ? 'Saving...' : 'Add reason'}</button>
                </div>
            </div>
        </section>
    );
}
