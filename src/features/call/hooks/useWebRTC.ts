import { useRef, useState, useCallback } from 'react';

const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};

export function useWebRTC() {
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const [peerStream, setPeerStream] = useState<MediaStream | null>(null);
    const [connectionState, setConnectionState] = useState<string>('new');

    const cleanup = useCallback(() => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(t => t.stop());
            localStreamRef.current = null;
        }
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
        setPeerStream(null);
        setConnectionState('new');
    }, []);

    const startMedia = useCallback(async (): Promise<MediaStream> => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        localStreamRef.current = stream;
        return stream;
    }, []);

    const createPeerConnection = useCallback((
        onIceCandidate: (candidate: RTCIceCandidate) => void,
        onConnectionStateChange?: (state: string) => void,
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
    ): Promise<RTCSessionDescriptionInit> => {
        const pc = createPeerConnection(onIceCandidate, onConnectionStateChange);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        return offer;
    }, [createPeerConnection]);

    const createAnswer = useCallback(async (
        offerSDP: RTCSessionDescriptionInit,
        onIceCandidate: (candidate: RTCIceCandidate) => void,
        onConnectionStateChange?: (state: string) => void,
    ): Promise<RTCSessionDescriptionInit> => {
        const pc = createPeerConnection(onIceCandidate, onConnectionStateChange);
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

    return {
        pcRef,
        localStreamRef,
        peerStream,
        connectionState,
        startMedia,
        createOffer,
        createAnswer,
        setRemoteSDP,
        addIceCandidate,
        toggleMute,
        cleanup,
    };
}
