import { useEffect, useState } from 'react';

interface CallTimerProps {
    startedAt: number | null;
}

export function CallTimer({ startedAt }: CallTimerProps) {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        if (startedAt == null) {
            setElapsed(0);
            return;
        }

        const tick = () => {
            setElapsed(Math.floor((Date.now() - startedAt) / 1000));
        };

        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [startedAt]);

    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    return (
        <span style={{
            fontSize: '2.2rem',
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            color: '#fff',
            letterSpacing: '0.04em',
            fontFamily: "'Inter', monospace",
        }}>
            {display}
        </span>
    );
}
