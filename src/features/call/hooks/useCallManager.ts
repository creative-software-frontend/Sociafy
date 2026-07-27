import { useEffect, useCallback, useRef } from 'react';
import { Socket } from 'socket.io-client';
import type { CallAction, CallState } from '../types/call';

interface WebRTCActions {
    pcRef: React.MutableRefObject<RTCPeerConnection | null>;
    localStreamRef: React.MutableRefObject<MediaStream | null>;
    startMedia: () => Promise<MediaStream>;
    createOffer: (
        onIce: (c: RTCIceCandidate) => void,
        onConnectionStateChange?: (state: string) => void,
    ) => Promise<RTCSessionDescriptionInit>;
    createAnswer: (
        offer: RTCSessionDescriptionInit,
        onIce: (c: RTCIceCandidate) => void,
        onConnectionStateChange?: (state: string) => void,
    ) => Promise<RTCSessionDescriptionInit>;
    setRemoteSDP: (sdp: RTCSessionDescriptionInit) => Promise<void>;
    addIceCandidate: (c: RTCIceCandidateInit) => Promise<void>;
    toggleMute: () => boolean;
    cleanup: () => void;
}

function onWebRTCStateChange(state: string, dispatch: React.Dispatch<CallAction>) {
    if (state === 'connected') {
        dispatch({ type: 'SET_CONNECTED' });
    } else if (state === 'failed') {
        dispatch({ type: 'SET_ERROR', payload: { message: 'Connection failed' } });
    }
}

export function useCallManager(socket: Socket | null, dispatch: React.Dispatch<CallAction>, webRTC: WebRTCActions) {
    const stateRef = useRef<CallState | null>(null);

    const emit = useCallback((event: string, data: unknown) => {
        socket?.emit(event, data);
    }, [socket]);

    const getIceCandidateSender = useCallback((targetId: number) => (candidate: RTCIceCandidate) => {
        emit('call:ice-candidate', { target_id: targetId, candidate: candidate.toJSON() });
    }, [emit]);

    const startCall = useCallback(async (peerId: number, peerName: string) => {
        if (!socket) {
            dispatch({ type: 'SET_ERROR', payload: { message: 'Not connected to server' } });
            setTimeout(() => dispatch({ type: 'RESET' }), 2000);
            return;
        }
        if (!socket.connected) {
            dispatch({ type: 'SET_ERROR', payload: { message: 'Connecting to server...' } });
            setTimeout(() => dispatch({ type: 'RESET' }), 2000);
            return;
        }
        try {
            await webRTC.startMedia();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Microphone access denied';
            if (msg.toLowerCase().includes('permission')) {
                dispatch({ type: 'SET_ERROR', payload: { message: 'Microphone permission required. Please allow mic access in your browser settings.' } });
            } else {
                dispatch({ type: 'SET_ERROR', payload: { message: msg } });
            }
            webRTC.cleanup();
            setTimeout(() => dispatch({ type: 'RESET' }), 3000);
            return;
        }
        dispatch({ type: 'SET_CALLING', payload: { peerId, peerName } });
        emit('call:request', { receiver_id: peerId, call_type: 'audio' });
    }, [socket, dispatch, webRTC, emit]);

    const acceptCall = useCallback(async () => {
        if (!socket || !stateRef.current) return;
        dispatch({ type: 'SET_CONNECTING' });
        try {
            await webRTC.startMedia();
            emit('call:accept', { caller_id: stateRef.current.peerId });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Microphone access denied';
            dispatch({ type: 'SET_ERROR', payload: { message: msg } });
            webRTC.cleanup();
            setTimeout(() => dispatch({ type: 'RESET' }), 2000);
        }
    }, [socket, dispatch, webRTC, emit]);

    const rejectCall = useCallback(() => {
        if (!socket) return;
        emit('call:reject', { caller_id: stateRef.current?.peerId });
        webRTC.cleanup();
        dispatch({ type: 'SET_REJECTED' });
        setTimeout(() => dispatch({ type: 'RESET' }), 2000);
    }, [socket, dispatch, webRTC, emit]);

    const endCall = useCallback(() => {
        if (!socket) return;
        const peerId = stateRef.current?.peerId;
        if (peerId) emit('call:end', { target_id: peerId });
        webRTC.cleanup();
        dispatch({ type: 'SET_ENDED' });
        setTimeout(() => dispatch({ type: 'RESET' }), 2000);
    }, [socket, dispatch, webRTC, emit]);

    const cancelCall = useCallback(() => {
        if (!socket) return;
        const peerId = stateRef.current?.peerId;
        if (peerId) emit('call:cancel', { receiver_id: peerId });
        webRTC.cleanup();
        dispatch({ type: 'SET_CANCELLED' });
        setTimeout(() => dispatch({ type: 'RESET' }), 2000);
    }, [socket, dispatch, webRTC, emit]);

    useEffect(() => {
        if (!socket) return;

        const onIncoming = (data: { caller_id: number; caller_name: string; caller_role?: string; call_type?: string }) => {
            dispatch({
                type: 'SET_INCOMING',
                payload: {
                    callerId: data.caller_id,
                    callerName: data.caller_name,
                    callerRole: data.caller_role,
                    callType: data.call_type || 'audio',
                },
            });
        };

        // Callee accepted → caller creates offer
        const onAccepted = async () => {
            dispatch({ type: 'SET_RINGING' });
            try {
                const targetId = stateRef.current?.peerId ?? 0;
                const onConnChange = (s: string) => onWebRTCStateChange(s, dispatch);
                const offer = await webRTC.createOffer(getIceCandidateSender(targetId), onConnChange);
                emit('call:offer', { receiver_id: stateRef.current?.peerId, sdp: offer });
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : 'Failed to create offer';
                dispatch({ type: 'SET_ERROR', payload: { message: msg } });
                webRTC.cleanup();
            }
        };

        // Caller sent SDP offer → callee creates answer
        const onOffer = async (data: { sdp: RTCSessionDescriptionInit; from: number }) => {
            const currentState = stateRef.current;
            if (!currentState || currentState.direction !== 'incoming') return;

            try {
                const targetId = currentState.peerId ?? 0;
                const onConnChange = (s: string) => onWebRTCStateChange(s, dispatch);
                const answer = await webRTC.createAnswer(data.sdp, getIceCandidateSender(targetId), onConnChange);
                emit('call:answer', { caller_id: currentState.peerId, sdp: answer });
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : 'Failed to create answer';
                dispatch({ type: 'SET_ERROR', payload: { message: msg } });
                webRTC.cleanup();
            }
        };

        // Callee sent answer SDP → caller sets remote description
        const onAnswer = async (data: { sdp: RTCSessionDescriptionInit; from: number }) => {
            const currentState = stateRef.current;
            if (!currentState || currentState.direction !== 'outgoing') return;
            try {
                await webRTC.setRemoteSDP(data.sdp);
            } catch {
                // Ignore SDP setting errors during ICE
            }
        };

        const onIceCandidate = async (data: { candidate: RTCIceCandidateInit }) => {
            await webRTC.addIceCandidate(data.candidate);
        };

        const onEnded = (data: { reason?: string }) => {
            webRTC.cleanup();
            if (data.reason === 'missed') {
                dispatch({ type: 'SET_MISSED' });
            } else {
                dispatch({ type: 'SET_ENDED' });
            }
            setTimeout(() => dispatch({ type: 'RESET' }), 1000);
        };

        const onRejected = () => {
            webRTC.cleanup();
            dispatch({ type: 'SET_REJECTED' });
            setTimeout(() => dispatch({ type: 'RESET' }), 2000);
        };

        const onBusy = () => {
            webRTC.cleanup();
            dispatch({ type: 'SET_BUSY' });
            setTimeout(() => dispatch({ type: 'RESET' }), 2000);
        };

        const onCancelled = () => {
            webRTC.cleanup();
            dispatch({ type: 'SET_CANCELLED' });
            setTimeout(() => dispatch({ type: 'RESET' }), 2000);
        };

        const onError = (data: { message: string }) => {
            webRTC.cleanup();
            dispatch({ type: 'SET_ERROR', payload: { message: data.message } });
            setTimeout(() => dispatch({ type: 'RESET' }), 3000);
        };

        socket.on('call:incoming', onIncoming);
        socket.on('call:accepted', onAccepted);
        socket.on('call:offer', onOffer);
        socket.on('call:answer', onAnswer);
        socket.on('call:ice-candidate', onIceCandidate);
        socket.on('call:ended', onEnded);
        socket.on('call:rejected', onRejected);
        socket.on('call:busy', onBusy);
        socket.on('call:cancelled', onCancelled);
        socket.on('call:error', onError);

        return () => {
            socket.off('call:incoming', onIncoming);
            socket.off('call:accepted', onAccepted);
            socket.off('call:offer', onOffer);
            socket.off('call:answer', onAnswer);
            socket.off('call:ice-candidate', onIceCandidate);
            socket.off('call:ended', onEnded);
            socket.off('call:rejected', onRejected);
            socket.off('call:busy', onBusy);
            socket.off('call:cancelled', onCancelled);
            socket.off('call:error', onError);
        };
    }, [socket, dispatch, webRTC, emit, getIceCandidateSender]);

    return { startCall, acceptCall, rejectCall, endCall, cancelCall, setStateRef: (s: CallState) => { stateRef.current = s; } };
}
