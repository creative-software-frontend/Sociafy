import { useEffect, useRef, useState, useCallback } from 'react';
import type { Post, PostComment } from '../../../../utils/api';
import { serviceApi, userApi } from '../../../../utils/api';
import { Avatar } from './Avatar';
import { API_ORIGIN } from '../../../../config/apiConfig';

const BACKEND_ORIGIN = API_ORIGIN;

function toFullUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    if (url.startsWith('/uploads/')) return `${BACKEND_ORIGIN}${url}`;
    return url;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface CardState {
    showComments: boolean;
    comments: PostComment[];
    commentsPage: number;
    commentsTotal: number;
    commentInput: string;
    submittingComment: boolean;
    loadingComments: boolean;
    showShareModal: boolean;
    shareCopied: boolean;
}

function defaultCardState(): CardState {
    return {
        showComments: false,
        comments: [],
        commentsPage: 1,
        commentsTotal: 0,
        commentInput: '',
        submittingComment: false,
        loadingComments: false,
        showShareModal: false,
        shareCopied: false,
    };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

// ─── Sub-components ───────────────────────────────────────────────────────────

function HeartIcon({ filled }: { filled: boolean }) {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'}
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
    );
}

function CommentIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
    );
}

function ShareIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
    );
}

function ImageIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
        </svg>
    );
}

// ─── Interaction Button ───────────────────────────────────────────────────────

interface ActionBtnProps {
    onClick: () => void;
    active?: boolean;
    activeColor?: string;
    label: string;
    icon: React.ReactNode;
    disabled?: boolean;
}

function ActionBtn({ onClick, active, activeColor = '#f472b6', label, icon, disabled }: ActionBtnProps) {
    const [hover, setHover] = useState(false);
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: hover ? 'rgba(197,168,128,0.12)' : 'transparent',
                border: 'none', borderRadius: 8,
                color: active ? activeColor : hover ? 'var(--gold-mid)' : 'var(--text-muted)',
                padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600,
                cursor: disabled ? 'default' : 'pointer',
                transition: 'all 0.18s', opacity: disabled ? 0.6 : 1,
            }}
        >
            {icon}
            {label}
        </button>
    );
}

// ─── Comment Item ─────────────────────────────────────────────────────────────

function CommentItem({ comment }: { comment: PostComment }) {
    return (
        <div style={{
            display: 'flex', gap: 10, padding: '10px 0',
            borderBottom: '1px solid var(--gold-border)',
        }}>
            <Avatar name={comment.author_name} size={30} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.82rem' }}>
                        {comment.author_name}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                        {timeAgo(comment.created_at)}
                    </span>
                </div>
                <p style={{
                    color: 'var(--text-secondary)', fontSize: '0.85rem',
                    lineHeight: 1.5, margin: 0, wordBreak: 'break-word',
                }}>
                    {comment.content}
                </p>
            </div>
        </div>
    );
}

// ─── Share Modal ──────────────────────────────────────────────────────────────

interface ShareModalProps {
    post: Post;
    shareUrl: string;
    copied: boolean;
    onCopy: () => void;
    onClose: () => void;
}

const EXTERNAL_CHANNELS = [
    {
        id: 'whatsapp',
        label: 'WhatsApp',
        color: '#25d366',
        icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
            </svg>
        ),
        getUrl: (url: string, text: string) =>
            `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`,
    },
    {
        id: 'facebook',
        label: 'Facebook',
        color: '#1877f2',
        icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
        ),
        getUrl: (url: string) =>
            `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    },
    {
        id: 'messenger',
        label: 'Messenger',
        color: '#0084ff',
        icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.497 1.745 6.616 4.472 8.652V24l4.086-2.242c1.09.301 2.246.464 3.442.464 6.627 0 12-4.975 12-11.111C24 4.974 18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.732 8.1l3.13 3.26L19.752 8.1l-6.561 6.863z" />
            </svg>
        ),
        getUrl: (url: string) =>
            `fb-messenger://share?link=${encodeURIComponent(url)}`,
    },
];

function ShareModal({ post, shareUrl, copied, onCopy, onClose }: ShareModalProps) {
    const shareText = `Check out this post by ${post.author_name} on Bluedise!`;

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: 'fixed', inset: 0, zIndex: 900,
                    background: 'rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(4px)',
                }}
            />

            {/* Sheet */}
            <div style={{
                position: 'fixed', bottom: 0, left: '50%',
                transform: 'translateX(-50%)',
                width: '100%', maxWidth: 480,
                zIndex: 901,
                background: 'linear-gradient(180deg, rgba(11,21,45,0.99), rgba(7,16,32,0.99))',
                border: '1px solid var(--gold-border)',
                borderBottom: 'none',
                borderRadius: '20px 20px 0 0',
                padding: '0 0 calc(80px + env(safe-area-inset-bottom, 0px))',
                boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
                animation: 'slideUp 0.22s ease',
            }}>
                {/* Handle */}
                <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 6px' }}>
                    <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
                </div>

                {/* Title */}
                <div style={{
                    padding: '4px 20px 16px',
                    borderBottom: '1px solid var(--gold-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    <div>
                        <p style={{ margin: 0, fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>
                            Share Post
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            by {post.author_name}
                        </p>
                    </div>
                    <button onClick={onClose} style={{
                        background: 'rgba(255,255,255,0.07)', border: 'none',
                        borderRadius: '50%', width: 32, height: 32,
                        color: 'var(--text-muted)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16, fontWeight: 700,
                    }}>✕</button>
                </div>

                {/* External share row */}
                <div style={{ padding: '18px 20px 14px' }}>
                    <p style={{
                        margin: '0 0 12px', fontSize: '0.7rem', letterSpacing: '0.1em',
                        color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase',
                    }}>Share via</p>
                    <div style={{ display: 'flex', gap: 16 }}>
                        {EXTERNAL_CHANNELS.map(ch => (
                            <a
                                key={ch.id}
                                href={ch.getUrl(shareUrl, shareText)}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                                    gap: 6, textDecoration: 'none', flex: 1,
                                }}
                            >
                                <div style={{
                                    width: 52, height: 52, borderRadius: 16,
                                    background: `${ch.color}18`,
                                    border: `1.5px solid ${ch.color}44`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: ch.color, transition: 'all 0.18s',
                                }}>
                                    {ch.icon}
                                </div>
                                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                    {ch.label}
                                </span>
                            </a>
                        ))}
                    </div>
                </div>

                {/* Divider */}
                <div style={{ margin: '0 20px', height: 1, background: 'var(--gold-border)' }} />

                {/* Internal copy link */}
                <div style={{ padding: '16px 20px' }}>
                    <p style={{
                        margin: '0 0 10px', fontSize: '0.7rem', letterSpacing: '0.1em',
                        color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase',
                    }}>Copy link</p>
                    <div style={{
                        display: 'flex', gap: 8, alignItems: 'center',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid var(--gold-border)',
                        borderRadius: 12, padding: '10px 12px',
                    }}>
                        <span style={{
                            flex: 1, fontSize: '0.75rem', color: 'var(--text-muted)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                            {shareUrl}
                        </span>
                        <button
                            onClick={onCopy}
                            style={{
                                background: copied
                                    ? 'rgba(52,211,153,0.2)'
                                    : 'linear-gradient(135deg, var(--gold-rich), var(--gold-deep))',
                                border: copied ? '1px solid #34d399' : 'none',
                                borderRadius: 8, color: copied ? '#34d399' : '#fff',
                                padding: '6px 14px', fontSize: '0.75rem', fontWeight: 700,
                                cursor: 'pointer', whiteSpace: 'nowrap',
                                transition: 'all 0.2s', flexShrink: 0,
                            }}
                        >
                            {copied ? 'Copied!' : 'Copy'}
                        </button>
                    </div>
                </div>
            </div>

            <style>{`@keyframes slideUp { from { transform: translateX(-50%) translateY(100%); } to { transform: translateX(-50%) translateY(0); } }`}</style>
        </>
    );
}

// ─── Post Card ────────────────────────────────────────────────────────────────

interface PostCardProps {
    post: Post;
    cardState: CardState;
    onLike: () => void;
    onToggleComments: () => void;
    onLoadMoreComments: () => void;
    onCommentInputChange: (val: string) => void;
    onSubmitComment: () => void;
    onShare: () => void;
    onShareCopy: () => void;
    onShareClose: () => void;
}

function PostCard({
    post, cardState,
    onLike, onToggleComments, onLoadMoreComments,
    onCommentInputChange, onSubmitComment,
    onShare, onShareCopy, onShareClose,
}: PostCardProps) {
    const hasMoreComments = cardState.comments.length < cardState.commentsTotal;

    return (
        <div style={{
            background: 'linear-gradient(135deg, rgba(11,21,45,0.92), rgba(7,16,32,0.92))',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-xl)', overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            animation: 'fadeIn 0.3s ease',
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 16px 12px' }}>
                <Avatar name={post.author_name} size={40} />
                <div style={{ flex: 1 }}>
                    <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.92rem', margin: 0 }}>
                        {post.author_name}
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', margin: '2px 0 0' }}>
                        {post.author_role.toUpperCase()} · {timeAgo(post.created_at)}
                    </p>
                </div>
                {post.author_role === 'provider' && (
                    <span style={{
                        fontSize: '0.6rem', letterSpacing: '0.1em',
                        background: 'rgba(197,168,128,0.12)',
                        border: '1px solid var(--gold-border)',
                        color: 'var(--gold-mid)', padding: '3px 8px', borderRadius: 20, fontWeight: 700,
                    }}>PROVIDER</span>
                )}
            </div>

            {/* Content */}
            <div style={{ padding: '0 16px' }}>
                <p style={{ color: 'var(--text-primary)', fontSize: '0.92rem', lineHeight: 1.6, margin: 0 }}>
                    {post.content}
                </p>
                {post.image_url && (
                    <img src={toFullUrl(post.image_url) ?? undefined} alt="post"
                        style={{
                            width: '100%', borderRadius: 10, display: 'block',
                            maxHeight: 320, objectFit: 'cover', marginTop: 12,
                            border: '1px solid var(--gold-border)',
                        }} />
                )}
            </div>

            {/* Stats row */}
            {(post.like_count > 0 || post.comment_count > 0 || post.share_count > 0) && (
                <div style={{
                    display: 'flex', gap: 16, padding: '10px 16px 4px',
                    color: 'var(--text-muted)', fontSize: '0.75rem',
                    borderTop: 'none',
                }}>
                    {post.like_count > 0 && (
                        <span>{post.like_count} {post.like_count === 1 ? 'like' : 'likes'}</span>
                    )}
                    {post.comment_count > 0 && (
                        <button onClick={onToggleComments} style={{
                            background: 'none', border: 'none', padding: 0,
                            color: 'var(--text-muted)', fontSize: '0.75rem',
                            cursor: 'pointer', textDecoration: 'underline dotted',
                        }}>
                            {post.comment_count} {post.comment_count === 1 ? 'comment' : 'comments'}
                        </button>
                    )}
                    {post.share_count > 0 && (
                        <span>{post.share_count} {post.share_count === 1 ? 'share' : 'shares'}</span>
                    )}
                </div>
            )}

            {/* Action bar */}
            <div style={{
                display: 'flex', alignItems: 'center',
                borderTop: '1px solid var(--gold-border)',
                margin: '10px 8px 0', padding: '4px 0',
            }}>
                <ActionBtn
                    onClick={onLike}
                    active={post.user_has_liked}
                    activeColor="#f472b6"
                    label={post.user_has_liked ? 'Liked' : 'Like'}
                    icon={<HeartIcon filled={post.user_has_liked} />}
                />
                <ActionBtn
                    onClick={onToggleComments}
                    label="Comment"
                    icon={<CommentIcon />}
                />
                <ActionBtn
                    onClick={onShare}
                    label="Share"
                    icon={<ShareIcon />}
                />
            </div>

            {/* Share modal */}
            {cardState.showShareModal && (
                <ShareModal
                    post={post}
                    shareUrl={`${window.location.origin}/user/dashboard/newsfeed#post-${post.id}`}
                    copied={cardState.shareCopied}
                    onCopy={onShareCopy}
                    onClose={onShareClose}
                />
            )}

            {/* Comment section */}
            {cardState.showComments && (
                <div style={{ padding: '0 16px 16px' }}>
                    {/* Existing comments */}
                    {cardState.loadingComments && cardState.comments.length === 0 ? (
                        <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            Loading comments…
                        </div>
                    ) : (
                        <>
                            {cardState.comments.map(c => (
                                <CommentItem key={c.id} comment={c} />
                            ))}
                            {hasMoreComments && (
                                <button
                                    onClick={onLoadMoreComments}
                                    disabled={cardState.loadingComments}
                                    style={{
                                        background: 'none', border: 'none', padding: '8px 0 4px',
                                        color: 'var(--gold-mid)', fontSize: '0.78rem', cursor: 'pointer',
                                        fontWeight: 600, opacity: cardState.loadingComments ? 0.5 : 1,
                                    }}>
                                    {cardState.loadingComments ? 'Loading…' : `Load more (${cardState.commentsTotal - cardState.comments.length} remaining)`}
                                </button>
                            )}
                            {cardState.comments.length === 0 && (
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '12px 0 4px' }}>
                                    No comments yet. Be the first!
                                </p>
                            )}
                        </>
                    )}

                    {/* New comment input */}
                    <div style={{ display: 'flex', gap: 10, marginTop: 14, alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                            <textarea
                                value={cardState.commentInput}
                                onChange={e => onCommentInputChange(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        onSubmitComment();
                                    }
                                }}
                                placeholder="Write a comment… (Enter to send)"
                                rows={2}
                                style={{
                                    width: '100%', background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid var(--gold-border)',
                                    borderRadius: 10, color: 'var(--text-primary)',
                                    padding: '8px 12px', resize: 'none',
                                    fontFamily: "'Inter', sans-serif", fontSize: '0.84rem',
                                    outline: 'none', lineHeight: 1.5, boxSizing: 'border-box',
                                }}
                                onFocus={e => { e.currentTarget.style.borderColor = 'var(--gold-rich)'; }}
                                onBlur={e => { e.currentTarget.style.borderColor = 'var(--gold-border)'; }}
                            />
                        </div>
                        <button
                            onClick={onSubmitComment}
                            disabled={cardState.submittingComment || !cardState.commentInput.trim()}
                            style={{
                                background: cardState.submittingComment || !cardState.commentInput.trim()
                                    ? 'rgba(197,168,128,0.3)'
                                    : 'linear-gradient(135deg, var(--gold-rich), var(--gold-deep))',
                                border: 'none', borderRadius: 10, color: '#0b0f1a',
                                padding: '8px 16px', fontSize: '0.8rem', fontWeight: 700,
                                cursor: cardState.submittingComment || !cardState.commentInput.trim() ? 'default' : 'pointer',
                                transition: 'all 0.2s', whiteSpace: 'nowrap',
                                boxShadow: '0 0 10px rgba(197,168,128,0.3)',
                                height: 62,
                            }}>
                            {cardState.submittingComment ? '…' : 'Send'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Compose Card ─────────────────────────────────────────────────────────────

interface ComposeCardProps {
    myName: string;
    onPostCreated: (post: Post) => void;
}

function ComposeCard({ myName, onPostCreated }: ComposeCardProps) {
    const [content, setContent] = useState('');
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [posting, setPosting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!ALLOWED_TYPES.has(file.type)) {
            setError('Only jpg, jpeg, png, webp images are allowed.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setError('Image must be under 5 MB.');
            return;
        }

        setError(null);
        // Show local preview immediately
        const localUrl = URL.createObjectURL(file);
        setImagePreview(localUrl);
        setUploadedImageUrl(null);

        setUploading(true);
        try {
            const res = await userApi.uploadImage(file, 'posts');
            if (res.error || !res.data?.url) {
                throw new Error(res.error || 'Upload failed');
            }
            setUploadedImageUrl(res.data.url);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Image upload failed.');
            setImagePreview(null);
            setUploadedImageUrl(null);
            if (fileRef.current) fileRef.current.value = '';
        } finally {
            setUploading(false);
        }
    };

    const clearImage = () => {
        setImagePreview(null);
        setUploadedImageUrl(null);
        if (fileRef.current) fileRef.current.value = '';
    };

    const submitPost = async () => {
        if (!content.trim()) { setError('Write something first!'); return; }
        if (uploading) { setError('Please wait for the image to finish uploading.'); return; }

        setPosting(true);
        setError(null);
        const res = await serviceApi.createPost(content.trim(), uploadedImageUrl);
        setPosting(false);

        if (res.error) { setError(res.error); return; }
        if (res.data) {
            // New posts from backend may not have counts yet — default to 0
            onPostCreated({
                ...res.data,
                like_count: res.data.like_count ?? 0,
                comment_count: res.data.comment_count ?? 0,
                share_count: res.data.share_count ?? 0,
                user_has_liked: res.data.user_has_liked ?? false,
            });
        }
        setContent('');
        clearImage();
    };

    return (
        <div style={{
            background: 'linear-gradient(135deg, rgba(11,21,45,0.97), rgba(7,16,32,0.97))',
            border: '1px solid var(--gold-border)',
            borderRadius: 'var(--radius-xl)', padding: '18px 16px',
            boxShadow: '0 0 24px rgba(197,168,128,0.12)',
        }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <Avatar name={myName} size={40} />
                <textarea
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="Share something with the community…"
                    rows={3}
                    style={{
                        flex: 1, background: 'rgba(255,255,255,0.05)',
                        border: '1px solid var(--gold-border)',
                        borderRadius: 10, color: 'var(--text-primary)',
                        padding: '10px 12px', resize: 'none',
                        fontFamily: "'Inter', sans-serif", fontSize: '0.9rem',
                        outline: 'none', lineHeight: 1.5,
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--gold-rich)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--gold-border)'; }}
                />
            </div>

            {imagePreview && (
                <div style={{ position: 'relative', marginBottom: 12 }}>
                    <img src={imagePreview} alt="preview" style={{
                        width: '100%', maxHeight: 200, objectFit: 'cover',
                        borderRadius: 10, display: 'block',
                        opacity: uploading ? 0.5 : 1, transition: 'opacity 0.2s',
                    }} />
                    {uploading && (
                        <div style={{
                            position: 'absolute', inset: 0, display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            borderRadius: 10,
                        }}>
                            <span style={{
                                background: 'rgba(0,0,0,0.7)', color: 'var(--gold-mid)',
                                padding: '6px 14px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700,
                            }}>Uploading…</span>
                        </div>
                    )}
                    {!uploading && (
                        <button onClick={clearImage} style={{
                            position: 'absolute', top: 8, right: 8,
                            background: 'rgba(0,0,0,0.75)', border: 'none', borderRadius: '50%',
                            width: 28, height: 28, color: '#fff', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                        }}>✕</button>
                    )}
                    {uploadedImageUrl && !uploading && (
                        <div style={{
                            position: 'absolute', bottom: 8, right: 8,
                            background: 'rgba(52,211,153,0.85)', color: '#fff',
                            fontSize: '0.68rem', fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                        }}>Uploaded</div>
                    )}
                </div>
            )}

            {error && (
                <p style={{ color: '#f87171', fontSize: '0.8rem', marginBottom: 10 }}>{error}</p>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'rgba(197,168,128,0.1)',
                    border: '1px solid var(--gold-border)',
                    borderRadius: 8, color: 'var(--gold-mid)', padding: '7px 14px',
                    fontSize: '0.78rem', cursor: uploading ? 'wait' : 'pointer',
                    fontWeight: 600, transition: 'all 0.2s', opacity: uploading ? 0.6 : 1,
                }}>
                    <ImageIcon />
                    {uploading ? 'Uploading…' : 'Photo'}
                </button>
                <input ref={fileRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleImage} style={{ display: 'none' }} />

                <button onClick={submitPost} disabled={posting || uploading} style={{
                    background: posting || uploading
                        ? 'rgba(197,168,128,0.4)'
                        : 'linear-gradient(135deg, var(--gold-rich), var(--gold-deep))',
                    border: 'none', borderRadius: 8, color: '#0b0f1a',
                    padding: '8px 22px', fontSize: '0.82rem', fontWeight: 700,
                    cursor: posting || uploading ? 'wait' : 'pointer',
                    transition: 'all 0.2s', boxShadow: '0 0 12px rgba(197,168,128,0.4)',
                }}>
                    {posting ? 'Posting…' : 'Post'}
                </button>
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function NewsfeedTab({ myName }: { myName: string }) {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [cardStates, setCardStates] = useState<Map<number, CardState>>(new Map());

    // ── Helpers ──────────────────────────────────────────────────────────────

    const getCard = useCallback((postId: number): CardState => {
        return cardStates.get(postId) ?? defaultCardState();
    }, [cardStates]);

    const setCard = useCallback((postId: number, patch: Partial<CardState>) => {
        setCardStates(prev => {
            const next = new Map(prev);
            const existing = next.get(postId) ?? defaultCardState();
            next.set(postId, { ...existing, ...patch });
            return next;
        });
    }, []);

    // ── Load Feed ─────────────────────────────────────────────────────────────

    const loadPosts = async () => {
        setLoading(true);
        const res = await serviceApi.getPosts();
        if (!res.error && res.data) setPosts(res.data);
        setLoading(false);
    };

    useEffect(() => { loadPosts(); }, []);

    // ── Like (optimistic) ─────────────────────────────────────────────────────

    const handleLike = async (post: Post) => {
        const wasLiked = post.user_has_liked;
        const optimisticLikeCount = wasLiked ? post.like_count - 1 : post.like_count + 1;

        // Optimistic update
        setPosts(prev => prev.map(p =>
            p.id === post.id
                ? { ...p, user_has_liked: !wasLiked, like_count: optimisticLikeCount }
                : p
        ));

        const res = await serviceApi.toggleLike(post.id);
        if (res.error || !res.data) {
            // Revert on failure
            setPosts(prev => prev.map(p =>
                p.id === post.id
                    ? { ...p, user_has_liked: wasLiked, like_count: post.like_count }
                    : p
            ));
        } else {
            // Sync with server truth
            setPosts(prev => prev.map(p =>
                p.id === post.id
                    ? { ...p, user_has_liked: res.data!.liked, like_count: res.data!.likeCount }
                    : p
            ));
        }
    };

    // ── Comments ──────────────────────────────────────────────────────────────

    const handleToggleComments = async (post: Post) => {
        const card = getCard(post.id);
        const willOpen = !card.showComments;

        setCard(post.id, { showComments: willOpen });

        if (willOpen && card.comments.length === 0) {
            setCard(post.id, { showComments: true, loadingComments: true });
            const res = await serviceApi.getComments(post.id, 1);
            if (res.data) {
                setCard(post.id, {
                    comments: res.data.comments,
                    commentsPage: 1,
                    commentsTotal: res.data.total,
                    loadingComments: false,
                });
            } else {
                setCard(post.id, { loadingComments: false });
            }
        }
    };

    const handleLoadMoreComments = async (post: Post) => {
        const card = getCard(post.id);
        const nextPage = card.commentsPage + 1;
        setCard(post.id, { loadingComments: true });

        const res = await serviceApi.getComments(post.id, nextPage);
        if (res.data) {
            setCard(post.id, {
                comments: [...card.comments, ...res.data.comments],
                commentsPage: nextPage,
                commentsTotal: res.data.total,
                loadingComments: false,
            });
        } else {
            setCard(post.id, { loadingComments: false });
        }
    };

    const handleSubmitComment = async (post: Post) => {
        const card = getCard(post.id);
        if (!card.commentInput.trim() || card.submittingComment) return;

        setCard(post.id, { submittingComment: true });
        const res = await serviceApi.addComment(post.id, card.commentInput.trim());
        setCard(post.id, { submittingComment: false });

        if (res.data) {
            setCard(post.id, {
                comments: [...card.comments, res.data],
                commentInput: '',
                commentsTotal: card.commentsTotal + 1,
            });
            // Update comment_count on the post
            setPosts(prev => prev.map(p =>
                p.id === post.id ? { ...p, comment_count: p.comment_count + 1 } : p
            ));
        }
    };

    // ── Share ─────────────────────────────────────────────────────────────────

    const handleOpenShare = (post: Post) => {
        setCard(post.id, { showShareModal: true, shareCopied: false });
    };

    const handleCloseShare = (post: Post) => {
        setCard(post.id, { showShareModal: false });
    };

    const handleCopyLink = async (post: Post) => {
        const shareUrl = `${window.location.origin}/user/dashboard/newsfeed#post-${post.id}`;

        try {
            await navigator.clipboard.writeText(shareUrl);
        } catch {
            const el = document.createElement('textarea');
            el.value = shareUrl;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
        }

        setCard(post.id, { shareCopied: true });
        setTimeout(() => setCard(post.id, { shareCopied: false }), 2500);

        // Record share on backend
        serviceApi.sharePost(post.id).then(res => {
            if (res.data) {
                setPosts(prev => prev.map(p =>
                    p.id === post.id ? { ...p, share_count: res.data!.shareCount } : p
                ));
            }
        });
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <style>{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
            `}</style>

            <ComposeCard myName={myName} onPostCreated={post => setPosts(prev => [post, ...prev])} />

            {loading ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-secondary)' }}>
                    <div style={{
                        width: 36, height: 36, border: '3px solid rgba(197,168,128,0.3)',
                        borderTopColor: 'var(--gold-rich)', borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                        margin: '0 auto 12px',
                    }} />
                    Loading feed…
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
            ) : posts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                    <CommentIcon />
                    <p style={{ marginTop: 12 }}>No posts yet. Be the first to share!</p>
                </div>
            ) : (
                posts.map(post => (
                    <PostCard
                        key={post.id}
                        post={post}
                        cardState={getCard(post.id)}
                        onLike={() => handleLike(post)}
                        onToggleComments={() => handleToggleComments(post)}
                        onLoadMoreComments={() => handleLoadMoreComments(post)}
                        onCommentInputChange={val => setCard(post.id, { commentInput: val })}
                        onSubmitComment={() => handleSubmitComment(post)}
                        onShare={() => handleOpenShare(post)}
                        onShareCopy={() => handleCopyLink(post)}
                        onShareClose={() => handleCloseShare(post)}
                    />
                ))
            )}
        </div>
    );
}
