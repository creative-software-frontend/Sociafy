export class CallAudioManager {
    private ctx: AudioContext | null = null;
    private gain: GainNode | null = null;
    private ringtoneTimer: ReturnType<typeof setTimeout> | null = null;
    private ringbackTimer: ReturnType<typeof setTimeout> | null = null;
    private vibrationInterval: ReturnType<typeof setInterval> | null = null;
    private running = false;
    private wakeLock: WakeLockSentinel | null = null;

    /* ─── AudioContext ─── */
    private getCtx(): AudioContext {
        if (!this.ctx) {
            try { this.ctx = new AudioContext(); } catch { return null!; }
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return this.ctx;
    }

    /* ─── Ringtone (incoming) ─── */
    startIncomingRingtone(): void {
        this.stopAll();
        this.running = true;
        const c = this.getCtx();
        if (!c) return;

        this.gain = c.createGain();
        this.gain.gain.value = 0.15;
        this.gain.connect(c.destination);

        const play = (freq: number) => {
            if (!this.running) return;
            const o = c.createOscillator();
            o.type = 'sine';
            o.frequency.value = freq;
            o.connect(this.gain!);
            o.start(c.currentTime);
            o.stop(c.currentTime + 0.4);
            const next = freq === 440 ? 480 : 440;
            this.ringtoneTimer = setTimeout(() => { if (this.running) play(next); }, 900);
        };
        play(440);
    }

    stopIncomingRingtone(): void {
        this.running = false;
        if (this.ringtoneTimer) { clearTimeout(this.ringtoneTimer); this.ringtoneTimer = null; }
        this.gain = null;
    }

    /* ─── Ringback (outgoing) ─── */
    startOutgoingRingback(): void {
        this.stopAll();
        this.running = true;
        const c = this.getCtx();
        if (!c) return;

        this.gain = c.createGain();
        this.gain.gain.value = 0.12;
        this.gain.connect(c.destination);

        const play = () => {
            if (!this.running) return;
            const o = c.createOscillator();
            o.type = 'sine';
            o.frequency.value = 440;
            o.connect(this.gain!);
            o.start(c.currentTime);
            o.stop(c.currentTime + 0.3);
            this.ringbackTimer = setTimeout(() => { if (this.running) play(); }, 1200);
        };
        play();
    }

    stopOutgoingRingback(): void {
        this.running = false;
        if (this.ringbackTimer) { clearTimeout(this.ringbackTimer); this.ringbackTimer = null; }
        this.gain = null;
    }

    /* ─── Vibration ─── */
    startVibration(): void {
        this.stopVibration();
        if (!navigator.vibrate) return;
        const vibrate = () => navigator.vibrate?.([500, 300, 500]);
        vibrate();
        this.vibrationInterval = setInterval(vibrate, 4000);
    }

    stopVibration(): void {
        if (this.vibrationInterval) { clearInterval(this.vibrationInterval); this.vibrationInterval = null; }
        try { navigator.vibrate?.(0); } catch { /* ok */ }
    }

    /* ─── Wake Lock ─── */
    async acquireWakeLock(): Promise<void> {
        try {
            if ('wakeLock' in navigator && navigator.wakeLock) {
                this.wakeLock = await navigator.wakeLock.request('screen');
            }
        } catch { /* fail silently */ }
    }

    releaseWakeLock(): void {
        try { this.wakeLock?.release(); } catch { /* ok */ }
        this.wakeLock = null;
    }

    /* ─── Stop All ─── */
    stopAll(): void {
        this.stopIncomingRingtone();
        this.stopOutgoingRingback();
        this.stopVibration();
    }

    /* ─── Destroy ─── */
    destroy(): void {
        this.stopAll();
        this.releaseWakeLock();
        try { this.ctx?.close(); } catch { /* ok */ }
        this.ctx = null;
    }
}
