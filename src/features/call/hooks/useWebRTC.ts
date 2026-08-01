import { useRef, useState, useCallback } from 'react';
import type { CallStats, CallQuality } from '../types/call';

const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};

const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
};

export function useWebRTC() {
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastBytesRef = useRef<{ timestamp: number; bytes: number }>({ timestamp: 0, bytes: 0 });
    const deviceListenerRef = useRef<(() => void) | null>(null);

    const [peerStream, setPeerStream] = useState<MediaStream | null>(null);
    const [connectionState, setConnectionState] = useState<string>('new');
    const [iceConnectionState, setIceConnectionState] = useState<string>('new');
    const [signalingState, setSignalingState] = useState<string>('new');

    const cleanup = useCallback(() => {
        if (statsTimerRef.current) { clearInterval(statsTimerRef.current); statsTimerRef.current = null; }
        if (deviceListenerRef.current) {
            navigator.mediaDevices?.removeEventListener?.('devicechange', deviceListenerRef.current);
            deviceListenerRef.current = null;
        }
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(t => t.stop());
            localStreamRef.current = null;
        }
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
        lastBytesRef.current = { timestamp: 0, bytes: 0 };
        setPeerStream(null);
        setConnectionState('new');
        setIceConnectionState('new');
        setSignalingState('new');
    }, []);

    const startMedia = useCallback(async (): Promise<MediaStream> => {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: AUDIO_CONSTRAINTS,
            video: false,
        });
        localStreamRef.current = stream;
        return stream;
    }, []);

    const replaceStream = useCallback(async (): Promise<MediaStream | null> => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: AUDIO_CONSTRAINTS,
                video: false,
            });
            const newTrack = stream.getAudioTracks()[0];
            const pc = pcRef.current;
            if (pc) {
                const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
                if (sender && newTrack) {
                    await sender.replaceTrack(newTrack);
                }
            }
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(t => t.stop());
            }
            localStreamRef.current = stream;
            return stream;
        } catch {
            return null;
        }
    }, []);

    const createPeerConnection = useCallback((
        onIceCandidate: (candidate: RTCIceCandidate) => void,
        onConnectionStateChange?: (state: string) => void,
        onIceConnectionStateChange?: (state: string) => void,
    ): RTCPeerConnection => {
        const pc = new RTCPeerConnection(ICE_SERVERS);

        pc.onicecandidate = (e) => {
            if (e.candidate) onIceCandidate(e.candidate);
        };

        pc.ontrack = (e) => {
            setPeerStream(e.streams[0]);
        };

        pc.onconnectionstatechange = () => {
            setConnectionState(pc.connectionState);
            onConnectionStateChange?.(pc.connectionState);
        };

        pc.oniceconnectionstatechange = () => {
            setIceConnectionState(pc.iceConnectionState);
            onIceConnectionStateChange?.(pc.iceConnectionState);
        };

        pc.onsignalingstatechange = () => {
            setSignalingState(pc.signalingState);
        };

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                pc.addTrack(track, localStreamRef.current!);
            });
        }

        pcRef.current = pc;
        return pc;
    }, []);

    const createOffer = useCallback(async (
        onIceCandidate: (candidate: RTCIceCandidate) => void,
        onConnectionStateChange?: (state: string) => void,
        onIceConnectionStateChange?: (state: string) => void,
    ): Promise<RTCSessionDescriptionInit> => {
        const pc = createPeerConnection(onIceCandidate, onConnectionStateChange, onIceConnectionStateChange);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        return offer;
    }, [createPeerConnection]);

    const createAnswer = useCallback(async (
        offerSDP: RTCSessionDescriptionInit,
        onIceCandidate: (candidate: RTCIceCandidate) => void,
        onConnectionStateChange?: (state: string) => void,
        onIceConnectionStateChange?: (state: string) => void,
    ): Promise<RTCSessionDescriptionInit> => {
        const pc = createPeerConnection(onIceCandidate, onConnectionStateChange, onIceConnectionStateChange);
        await pc.setRemoteDescription(new RTCSessionDescription(offerSDP));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        return answer;
    }, [createPeerConnection]);

    const setRemoteSDP = useCallback(async (sdp: RTCSessionDescriptionInit) => {
        if (pcRef.current) {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
        }
    }, []);

    const addIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
        if (pcRef.current) {
            try {
                await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            } catch {
                // Ignore invalid candidates during transition
            }
        }
    }, []);

    const restartIce = useCallback(() => {
        const pc = pcRef.current;
        if (!pc) return;
        try {
            if (typeof pc.restartIce === 'function') {
                pc.restartIce();
            }
        } catch {
            // Fallback: create new offer with iceRestart
            try {
                pc.createOffer({ iceRestart: true }).then(offer => {
                    return pc.setLocalDescription(offer);
                });
            } catch { /* ok */ }
        }
    }, []);

    const toggleMute = useCallback((): boolean => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                return audioTrack.enabled;
            }
        }
        return false;
    }, []);

    /* ─── Stats monitoring ─── */
    const computeQuality = useCallback((stats: CallStats): Exclude<CallQuality, null> => {
        if (stats.packetLoss > 2 || stats.rtt > 300 || stats.jitter > 60) return 'poor';
        if (stats.packetLoss > 0.5 || stats.rtt > 150 || stats.jitter > 30) return 'good';
        return 'excellent';
    }, []);

    const collectStats = useCallback(async (): Promise<CallStats> => {
        const pc = pcRef.current;
        if (!pc) return { bitrate: 0, packetLoss: 0, rtt: 0, jitter: 0, quality: 'poor' };
        try {
            const report = await pc.getStats();
            let bitrate = 0, packetLoss = 0, rtt = 0, jitter = 0;
            let receivedBytes = lastBytesRef.current.bytes;
            let receivedTime = lastBytesRef.current.timestamp;

            report.forEach((r: any) => {
                if (r.type === 'candidate-pair' && r.nominated && r.currentRoundTripTime) {
                    rtt = r.currentRoundTripTime * 1000;
                }
                if (r.type === 'inbound-rtp' && r.kind === 'audio') {
                    packetLoss = r.packetsLost || 0;
                    jitter = (r.jitter || 0) * 1000;
                    if (r.bytesReceived && r.timestamp) {
                        const elapsed = (r.timestamp - receivedTime) / 1000;
                        if (elapsed > 0 && receivedBytes > 0) {
                            bitrate = ((r.bytesReceived - receivedBytes) * 8) / elapsed;
                        }
                        receivedBytes = r.bytesReceived;
                        receivedTime = r.timestamp;
                    }
                }
            });

            lastBytesRef.current = { timestamp: receivedTime, bytes: receivedBytes };

            // packetLoss is a cumulative count; normalize against total packets if available
            const quality = computeQuality({ bitrate, packetLoss, rtt, jitter, quality: 'good' });
            return { bitrate: Math.round(bitrate), packetLoss: Number(packetLoss.toFixed(2)), rtt: Math.round(rtt), jitter: Math.round(jitter), quality };
        } catch {
            return { bitrate: 0, packetLoss: 0, rtt: 0, jitter: 0, quality: 'poor' };
        }
    }, [computeQuality]);

    const startStatsMonitor = useCallback((onStats: (stats: CallStats) => void, interval = 3000) => {
        if (statsTimerRef.current) clearInterval(statsTimerRef.current);
        const poll = async () => {
            const s = await collectStats();
            onStats(s);
        };
        poll();
        statsTimerRef.current = setInterval(poll, interval);
    }, [collectStats]);

    const stopStatsMonitor = useCallback(() => {
        if (statsTimerRef.current) { clearInterval(statsTimerRef.current); statsTimerRef.current = null; }
    }, []);

    /* ─── Device change handling ─── */
    const registerDeviceChange = useCallback((onDeviceChange: () => void) => {
        if (navigator.mediaDevices?.addEventListener) {
            const handler = () => { onDeviceChange(); };
            deviceListenerRef.current = handler;
            navigator.mediaDevices.addEventListener('devicechange', handler);
        }
    }, []);

    const unregisterDeviceChange = useCallback(() => {
        if (deviceListenerRef.current) {
            navigator.mediaDevices?.removeEventListener?.('devicechange', deviceListenerRef.current);
            deviceListenerRef.current = null;
        }
    }, []);

    return {
        pcRef,
        localStreamRef,
        peerStream,
        connectionState,
        iceConnectionState,
        signalingState,
        startMedia,
        replaceStream,
        createOffer,
        createAnswer,
        setRemoteSDP,
        addIceCandidate,
        restartIce,
        toggleMute,
        startStatsMonitor,
        stopStatsMonitor,
        registerDeviceChange,
        unregisterDeviceChange,
        cleanup,
    };
}
