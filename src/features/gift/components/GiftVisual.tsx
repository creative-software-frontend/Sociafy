import { useState } from 'react';

export interface GiftVisualInput {
    name: string;
    icon?: string | null;
    image?: string | null;
    asset?: { url?: string } | null;
}

/**
 * Renders a gift's configured asset (persistent asset URL first, then legacy
 * image URL) and falls back to the emoji icon if no asset is set or the image
 * fails to load (e.g. the asset was removed). Never hardcodes gift media.
 */
export function GiftVisual({
    gift,
    size = 44,
    fontSize = '2rem',
}: {
    gift: GiftVisualInput;
    size?: number;
    fontSize?: string;
}) {
    const [failed, setFailed] = useState(false);
    const url = gift.asset?.url || gift.image;

    if (url && !failed) {
        return (
            <img
                src={url}
                alt={gift.name}
                style={{ width: size, height: size, objectFit: 'contain' }}
                onError={() => setFailed(true)}
            />
        );
    }
    return <span style={{ fontSize, lineHeight: 1 }}>{gift.icon || '🎁'}</span>;
}

export default GiftVisual;