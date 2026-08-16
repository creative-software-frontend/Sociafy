import { useCreateEvent } from './hooks/useCreateEvent';
import { useToast } from '../../../../../components/Toast';
import type { Event } from './types/event';
import { PointsIcon } from '../../../../../components/PointsDisplay';

interface EventFormProps {
    eventToEdit?: Event | null;
    onSuccess: () => void;
    onCancel: () => void;
}

/* ============================================================
   ICONS — inline SVG (no icon library in the project)
   ============================================================ */

const iconProps = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
};

const CalendarIcon = () => (
    <svg {...iconProps}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
);

const ClockIcon = () => (
    <svg {...iconProps}><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></svg>
);

const MapPinIcon = () => (
    <svg {...iconProps}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
);

const UsersIcon = () => (
    <svg {...iconProps}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
);

const TagIcon = () => (
    <svg {...iconProps}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
);

const TypeIcon = () => (
    <svg {...iconProps}><polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" /></svg>
);

const SpinnerIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
        <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.35)" strokeWidth="3" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </svg>
);

/* ============================================================
   SHARED STYLES — gold/blue SOCIAFY design system
   ============================================================ */

const labelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: 'var(--text-secondary)',
    fontSize: '0.62rem',
    fontWeight: 700,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    marginBottom: 8,
    fontFamily: "'Inter', sans-serif",
};

const inputBase: React.CSSProperties = {
    width: '100%',
    background: 'var(--bg-input)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-lg)',
    color: 'var(--text-primary)',
    padding: '11px 14px',
    fontSize: '0.85rem',
    fontFamily: "'Inter', sans-serif",
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s, box-shadow 0.2s',
};

function inputStyle(hasError: boolean): React.CSSProperties {
    return {
        ...inputBase,
        borderColor: hasError ? 'var(--red-status)' : 'var(--border-default)',
        boxShadow: hasError ? '0 0 0 3px rgba(239,68,68,0.12)' : 'none',
    };
}

const errorTextStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: 'var(--red-status)',
    fontSize: '0.72rem',
    marginTop: 6,
    fontFamily: "'Inter', sans-serif",
};

const sectionStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-xl)',
    padding: '18px 18px 20px',
};

const sectionTitleStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    color: 'var(--text-gold)',
    fontSize: '0.78rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: 16,
    fontFamily: "'Inter', sans-serif",
};

const sectionDivider: React.CSSProperties = {
    flex: 1,
    height: 1,
    background: 'linear-gradient(90deg, var(--gold-border), transparent)',
};

/* ============================================================
   FIELD HELPERS
   ============================================================ */

function Field({
    label,
    icon,
    htmlFor,
    error,
    children,
}: {
    label: string;
    icon: React.ReactNode;
    htmlFor: string;
    error?: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <label htmlFor={htmlFor} style={labelStyle}>
                <span style={{ color: 'var(--gold-mid)', display: 'inline-flex' }}>{icon}</span>
                {label}
            </label>
            {children}
            {error && (
                <span style={errorTextStyle}>
                    <span aria-hidden>⚠</span>
                    {error}
                </span>
            )}
        </div>
    );
}

export function EventForm({ eventToEdit, onSuccess, onCancel }: EventFormProps) {
    const toast = useToast();
    const {
        values,
        errors,
        submitting,
        submitError,
        handleChange,
        handleSubmit
    } = useCreateEvent({
        eventToEdit,
        onSuccess: () => {
            toast.success(eventToEdit ? 'Event updated successfully.' : 'Event created successfully.');
            onSuccess();
        }
    });

    const isEdit = !!eventToEdit;

    return (
        <>
        <style>{`
            .event-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
            @media (max-width: 540px) {
                .event-form-grid { grid-template-columns: 1fr; }
            }
        `}</style>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }} noValidate>
            {/* Section 1 — Event Information */}
            <section style={sectionStyle}>
                <div style={sectionTitleStyle}>
                    <TypeIcon />
                    Event Information
                    <span style={sectionDivider} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <Field label="Event Name" icon={<TagIcon />} htmlFor="title" error={errors.title}>
                        <input
                            id="title"
                            type="text"
                            name="title"
                            value={values.title}
                            onChange={handleChange}
                            placeholder="E.g., VIP Yacht Gathering"
                            style={inputStyle(!!errors.title)}
                        />
                    </Field>

                    <Field label="Description" icon={<TypeIcon />} htmlFor="description" error={errors.description}>
                        <textarea
                            id="description"
                            name="description"
                            value={values.description}
                            onChange={handleChange}
                            placeholder="Provide details about the exclusive experience..."
                            rows={5}
                            style={{ ...inputStyle(!!errors.description), resize: 'vertical', minHeight: 110, lineHeight: 1.5 }}
                        />
                    </Field>

                    <Field label="Host Name" icon={<UsersIcon />} htmlFor="host_name" error={errors.host_name}>
                        <input
                            id="host_name"
                            type="text"
                            name="host_name"
                            value={values.host_name}
                            onChange={handleChange}
                            placeholder="E.g., Blue Lounge Team"
                            style={inputStyle(!!errors.host_name)}
                        />
                    </Field>
                </div>
            </section>

            {/* Section 2 — Location & Schedule */}
            <section style={sectionStyle}>
                <div style={sectionTitleStyle}>
                    <MapPinIcon />
                    Location &amp; Schedule
                    <span style={sectionDivider} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <Field label="Location" icon={<MapPinIcon />} htmlFor="location" error={errors.location}>
                        <input
                            id="location"
                            type="text"
                            name="location"
                            value={values.location}
                            onChange={handleChange}
                            placeholder="E.g., Blue Lounge St. Tropez"
                            style={inputStyle(!!errors.location)}
                        />
                    </Field>

                    <div className="event-form-grid">
                        <Field label="Date" icon={<CalendarIcon />} htmlFor="date_time" error={errors.date_time}>
                            <input
                                id="date_time"
                                type="datetime-local"
                                name="date_time"
                                value={values.date_time}
                                onChange={handleChange}
                                style={inputStyle(!!errors.date_time)}
                            />
                        </Field>

                        <Field label="Application Deadline" icon={<ClockIcon />} htmlFor="application_deadline" error={errors.application_deadline}>
                            <input
                                id="application_deadline"
                                type="datetime-local"
                                name="application_deadline"
                                value={values.application_deadline}
                                onChange={handleChange}
                                style={inputStyle(!!errors.application_deadline)}
                            />
                        </Field>
                    </div>
                </div>
            </section>

            {/* Section 3 — Capacity & Pricing */}
            <section style={sectionStyle}>
                <div style={sectionTitleStyle}>
                    <UsersIcon />
                    Capacity &amp; Pricing
                    <span style={sectionDivider} />
                </div>

                <div className="event-form-grid">
                    <Field label="Maximum Participants" icon={<UsersIcon />} htmlFor="capacity" error={errors.capacity}>
                        <input
                            id="capacity"
                            type="number"
                            name="capacity"
                            value={values.capacity}
                            onChange={handleChange}
                            placeholder="0 = Unlimited"
                            min={0}
                            style={inputStyle(!!errors.capacity)}
                        />
                    </Field>

                    <Field label="Price" icon={<PointsIcon size={16} />} htmlFor="entry_fee" error={errors.entry_fee}>
                        <input
                            id="entry_fee"
                            type="number"
                            name="entry_fee"
                            value={values.entry_fee}
                            onChange={handleChange}
                            placeholder="0"
                            min={0}
                            step="0.01"
                            style={inputStyle(!!errors.entry_fee)}
                        />
                    </Field>
                </div>
            </section>

            {/* Edit-only — Status */}
            {isEdit && (
                <section style={sectionStyle}>
                    <div style={sectionTitleStyle}>
                        <TagIcon />
                        Status
                        <span style={sectionDivider} />
                    </div>
                    <Field label="Event Status" icon={<TagIcon />} htmlFor="status">
                        <select
                            id="status"
                            name="status"
                            value={values.status}
                            onChange={handleChange}
                            style={{ ...inputStyle(false), appearance: 'none', cursor: 'pointer' }}
                        >
                            <option value="active">Active</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </Field>
                </section>
            )}

            {submitError && (
                <div style={{
                    color: 'var(--red-status)',
                    fontSize: '0.82rem',
                    padding: '10px 14px',
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.25)',
                    borderRadius: 'var(--radius-lg)',
                    fontFamily: "'Inter', sans-serif",
                }}>
                    {submitError}
                </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 4 }}>
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={submitting}
                    style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-lg)',
                        color: 'var(--text-secondary)',
                        padding: '11px 22px',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        cursor: submitting ? 'not-allowed' : 'pointer',
                        fontFamily: "'Inter', sans-serif",
                        transition: 'all 0.2s',
                        opacity: submitting ? 0.6 : 1,
                    }}
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={submitting}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        background: submitting
                            ? 'rgba(197,168,128,0.35)'
                            : 'linear-gradient(135deg, var(--gold-rich), var(--gold-deep))',
                        border: '1px solid var(--gold-border)',
                        borderRadius: 'var(--radius-lg)',
                        color: '#0b0f1a',
                        padding: '11px 24px',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: submitting ? 'wait' : 'pointer',
                        fontFamily: "'Inter', sans-serif",
                        boxShadow: '0 0 18px rgba(197,168,128,0.25)',
                        transition: 'all 0.2s',
                        opacity: submitting ? 0.85 : 1,
                    }}
                >
                    {submitting && <SpinnerIcon />}
                    {submitting ? 'Creating Event...' : isEdit ? 'Save Changes' : 'Create Event'}
                </button>
            </div>
        </form>
        </>
    );
}
export default EventForm;
