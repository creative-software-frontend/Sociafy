import type { CSSProperties } from 'react';
import { Lottie } from 'lottie-react';
import coinAnimation from '../assets/coin.json';

/**
 * Animated coin/points glyph used as the currency-replacement icon throughout
 * the user-facing UI. Renders the project's `src/assets/coin.lottie` animation
 * (extracted as `coin.json`), zoomed into the coin via the SVG viewBox so the
 * coin fills the icon. Inherits the surrounding text color via `currentColor`
 * and works inline inside buttons, labels, cards, tables, inputs, gift cards,
 * chat, and mobile layouts.
 */
export function PointsIcon({ size = 20 }: { size?: number }) {
    return (
        <span
            className="points-icon"
            style={{
                display: 'inline-flex',
                width: size,
                height: size,
                flexShrink: 0,
                verticalAlign: 'middle',
                lineHeight: 0,
            }}
        >
            <Lottie
                src={coinAnimation}
                loop
                autoplay
                style={{ width: size, height: size, display: 'block' }}
                rendererSettings={{ viewBoxOnly: true, viewBoxSize: '100 100 300 300' }}
            />
        </span>
    );
}

/**
 * Renders a monetary value as Points, e.g. `[icon] 1,234`.
 *
 * - `amount`   numeric value (the underlying number is never altered).
 * - `decimals` optional fixed decimal places; when omitted the value is shown
 *   as an integer if whole, otherwise with up to 2 decimals (preserves each
 *   site's existing precision).
 * - `size`     icon size in px.
 * - `style`    optional override merged onto the wrapper.
 */
export function PointsDisplay({
    amount,
    decimals,
    size,
    style,
}: {
    amount: number | string;
    decimals?: number;
    size?: number;
    style?: CSSProperties;
}) {
    const n = Number(amount);
    const formatted = Number.isFinite(n)
        ? n.toLocaleString(undefined, {
              ...(decimals != null
                  ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals }
                  : { maximumFractionDigits: 2 }),
          })
        : '0';

    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                verticalAlign: 'middle',
                ...style,
            }}
        >
            <PointsIcon size={size} />
            <span>{formatted}</span>
        </span>
    );
}
