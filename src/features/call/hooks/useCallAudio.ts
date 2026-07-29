import { useEffect, useRef } from 'react';
import type { CallStatus } from '../types/call';
import { CallAudioManager } from '../services/CallAudioManager';

const RINGTONE_STATES: CallStatus[] = ['incoming'];
const RINGBACK_STATES: CallStatus[] = ['calling', 'ringing'];
const STOP_STATES: CallStatus[] = ['idle', 'connected', 'ended', 'busy', 'rejected', 'cancelled', 'missed', 'error'];

export function useCallAudio(status: CallStatus, direction: 'incoming' | 'outgoing' | null) {
    const managerRef = useRef<CallAudioManager | null>(null);

    useEffect(() => {
        if (!managerRef.current) managerRef.current = new CallAudioManager();
        const m = managerRef.current;

        const isIncoming = direction === 'incoming';
        const shouldRing = RINGTONE_STATES.includes(status) && isIncoming;
        const shouldRingback = RINGBACK_STATES.includes(status) && !isIncoming;
        const shouldStop = STOP_STATES.includes(status);

        if (shouldStop) {
            m.stopAll();
        } else if (shouldRing) {
            m.startIncomingRingtone();
            m.startVibration();
        } else if (shouldRingback) {
            m.startOutgoingRingback();
        }

        // Wake Lock: keep screen on during call
        if (status === 'connected') {
            m.acquireWakeLock();
        } else {
            m.releaseWakeLock();
        }

        return () => {
            m.stopAll();
        };
    }, [status, direction]);

    useEffect(() => {
        return () => {
            managerRef.current?.destroy();
            managerRef.current = null;
        };
    }, []);
}
