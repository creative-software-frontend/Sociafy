import { useEffect, useCallback, useRef } from 'react';
import { Socket } from 'socket.io-client';
import type { CallAction, CallState, CallStats, CallQuality } from '../types/call';

interface WebRTCActions {
    pcRef: React.MutableRefObject<RTCPeerConnection | null>;
    localStreamRef: React.MutableRefObject<MediaStream | null>;
    startMedia: () => Promise<MediaStream>;
    replaceStream: () => Promise<MediaStream | null>;
    createOffer: (
        onIce: (c: RTCIceCandidate) => void,
        onConnectionStateChange?: (state: string) => void,
        onIceConnectionStateChange?: (state: string) => void,
    ) => Promise<RTCSessionDescriptionInit>;
    createAnswer: (
        offer: RTCSessionDescriptionInit,
        onIce: (c: RTCIceCandidate) => void,
        onConnectionStateChange?: (state: string) => void,
        onIceConnectionStateChange?: (state: string) => void,
    ) => Promise<RTCSessionDescriptionInit>;
    setRemoteSDP: (sdp: RTCSessionDescriptionInit) => Promise<void>;
    addIceCandidate: (c: RTCIceCandidateInit) => Promise<void>;
    restartIce: () => void;
    toggleMute: () => boolean;
    startStatsMonitor: (cb: (stats: CallStats) => void, interval?: number) => void;
    stopStatsMonitor: () => void;
    registerDeviceChange: (cb: () => void) => void;
    unregisterDeviceChange: () => void;
    cleanup: () => void;
}

interface QualityCallbacks {
    onQuality: (quality: CallQuality) => void;
    onReconnect: (reconnecting: boolean) => void;
    onConnectionLost: (lost: boolean) => void;
}

function onWebRTCStateChange(
    state: string,
    dispatch: React.Dispatch<CallAction>,
    emit?: (event: string, data: unknown) => void,
    peerId?: number | null,
) {
    if (state === 'connected') {
        dispatch({ type: 'SET_CONNECTED' });
        // Signal the server that WebRTC truly connected — this is what makes the
        // call billable. Server validates this socket is part of the active call.
        emit?.('call:connected', {});
    } else if (state === 'failed') {
        if (peerId) emit?.('call:end', { target_id: peerId });
        dispatch({ type: 'SET_ERROR', payload: { message: 'Connection failed' } });
    }
}

export function useCallManager(
    socket: Socket | null,
    dispatch: React.Dispatch<CallAction>,
    webRTC: WebRTCActions,
    qualityCb: QualityCallbacks,
) {
    const stateRef = useRef<CallState | null>(null);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reconnectingRef = useRef(false);

    const emit = useCallback((event: string, data: unknown) => {
        socket?.emit(event, data);
    }, [socket]);

    const getIceCandidateSender = useCallback((targetId: number) => (candidate: RTCIceCandidate) => {
        emit('call:ice-candidate', { target_id: targetId, candidate: candidate.toJSON() });
    }, [emit]);

    const clearConnectTimeout = useCallback(() => {
        if (connectTimeoutRef.current) { clearTimeout(connectTimeoutRef.current); connectTimeoutRef.current = null; }
    }, []);

    const startConnectTimeout = useCallback((cb: () => void, ms = 30000) => {
        clearConnectTimeout();
        connectTimeoutRef.current = setTimeout(cb, ms);
    }, [clearConnectTimeout]);

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
            if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('denied') || msg.toLowerCase().includes('notallowed')) {
                dispatch({ type: 'SET_ERROR', payload: { message: 'Microphone permission is blocked. Please enable microphone access in your browser settings.' } });
            } else {
                dispatch({ type: 'SET_ERROR', payload: { message: msg } });
            }
            webRTC.cleanup();
            setTimeout(() => dispatch({ type: 'RESET' }), 3000);
            return;
        }
        console.log(`[startCall] emitting call:request with receiver_id=${peerId} peerName=${peerName}`);
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
            if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('denied') || msg.toLowerCase().includes('notallowed')) {
                dispatch({ type: 'SET_ERROR', payload: { message: 'Microphone permission is blocked. Please enable microphone access in your browser settings.' } });
            } else {
                dispatch({ type: 'SET_ERROR', payload: { message: msg } });
            }
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
        webRTC.stopStatsMonitor();
        webRTC.unregisterDeviceChange();
        webRTC.cleanup();
        if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
        clearConnectTimeout();
        reconnectingRef.current = false;
        qualityCb.onReconnect(false);
        qualityCb.onConnectionLost(false);
        dispatch({ type: 'SET_ENDED' });
        setTimeout(() => dispatch({ type: 'RESET' }), 1000);
    }, [socket, dispatch, webRTC, clearConnectTimeout, qualityCb]);

    const cancelCall = useCallback(() => {
        if (!socket) return;
        const peerId = stateRef.current?.peerId;
        if (peerId) emit('call:cancel', { receiver_id: peerId });
        webRTC.stopStatsMonitor();
        webRTC.unregisterDeviceChange();
        webRTC.cleanup();
        if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
        clearConnectTimeout();
        reconnectingRef.current = false;
        qualityCb.onReconnect(false);
        dispatch({ type: 'SET_CANCELLED' });
        setTimeout(() => dispatch({ type: 'RESET' }), 2000);
    }, [socket, dispatch, webRTC, clearConnectTimeout, qualityCb]);

    const handleIceConnectionChange = useCallback((state: string) => {
        if (state === 'disconnected' && stateRef.current?.status === 'connected') {
            reconnectingRef.current = true;
            qualityCb.onReconnect(true);
            // Start 15s reconnect timer
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = setTimeout(() => {
                // Reconnection failed — end gracefully
                if (reconnectingRef.current) {
                    reconnectingRef.current = false;
                    qualityCb.onReconnect(false);
                    qualityCb.onConnectionLost(true);
                    endCall();
                }
            }, 15000);
            webRTC.restartIce();
        } else if (state === 'connected' || state === 'completed') {
            if (reconnectingRef.current) {
                reconnectingRef.current = false;
                if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
                qualityCb.onReconnect(false);
                qualityCb.onConnectionLost(false);
            }
            clearConnectTimeout();
            dispatch({ type: 'SET_CONNECTED' });
        } else if (state === 'failed') {
            if (reconnectingRef.current) {
                reconnectingRef.current = false;
                if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
                qualityCb.onReconnect(false);
                qualityCb.onConnectionLost(true);
            }
            endCall();
        }
    }, [qualityCb, webRTC, clearConnectTimeout, dispatch, endCall]);

    // Clean up timers on unmount
    useEffect(() => {
        return () => {
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            clearConnectTimeout();
        };
    }, [clearConnectTimeout]);

    useEffect(() => {
        if (!socket) return;

        const onIncoming = (data: { caller_id: number; caller_name: string; caller_role?: string; call_type?: string }) => {
            console.log(`[call:incoming] received caller_id=${data.caller_id} caller_name=${data.caller_name}`);
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
                const onConnChange = (s: string) => onWebRTCStateChange(s, dispatch, emit, stateRef.current?.peerId);
                const offer = await webRTC.createOffer(getIceCandidateSender(targetId), onConnChange, handleIceConnectionChange);
                // Start connection timeout — must connect within 30s
                startConnectTimeout(() => {
                    endCall();
                });
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
                const onConnChange = (s: string) => onWebRTCStateChange(s, dispatch, emit, stateRef.current?.peerId);
                const answer = await webRTC.createAnswer(data.sdp, getIceCandidateSender(targetId), onConnChange, handleIceConnectionChange);
                startConnectTimeout(() => {
                    endCall();
                });
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
            webRTC.stopStatsMonitor();
            webRTC.unregisterDeviceChange();
            webRTC.cleanup();
            if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
            clearConnectTimeout();
            reconnectingRef.current = false;
            qualityCb.onReconnect(false);
            qualityCb.onConnectionLost(false);
            if (data.reason === 'missed') {
                dispatch({ type: 'SET_MISSED' });
            } else {
                dispatch({ type: 'SET_ENDED' });
            }
            setTimeout(() => dispatch({ type: 'RESET' }), 1000);
        };

        // Balance watchdog on server ended the call — clean up everything now.
        const onBalanceExhausted = () => {
            webRTC.stopStatsMonitor();
            webRTC.unregisterDeviceChange();
            webRTC.cleanup();
            if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
            clearConnectTimeout();
            reconnectingRef.current = false;
            qualityCb.onReconnect(false);
            qualityCb.onConnectionLost(false);
            dispatch({ type: 'SET_ENDED' });
            setTimeout(() => dispatch({ type: 'RESET' }), 1000);
        };

        const onRejected = () => {
            webRTC.stopStatsMonitor();
            webRTC.unregisterDeviceChange();
            webRTC.cleanup();
            if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
            clearConnectTimeout();
            reconnectingRef.current = false;
            qualityCb.onReconnect(false);
            dispatch({ type: 'SET_REJECTED' });
            setTimeout(() => dispatch({ type: 'RESET' }), 2000);
        };

        const onBusy = () => {
            webRTC.stopStatsMonitor();
            webRTC.unregisterDeviceChange();
            webRTC.cleanup();
            if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
            clearConnectTimeout();
            reconnectingRef.current = false;
            qualityCb.onReconnect(false);
            dispatch({ type: 'SET_BUSY' });
            setTimeout(() => dispatch({ type: 'RESET' }), 2000);
        };

        const onCancelled = () => {
            webRTC.stopStatsMonitor();
            webRTC.unregisterDeviceChange();
            webRTC.cleanup();
            if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
            clearConnectTimeout();
            reconnectingRef.current = false;
            qualityCb.onReconnect(false);
            dispatch({ type: 'SET_CANCELLED' });
            setTimeout(() => dispatch({ type: 'RESET' }), 2000);
        };

        const onError = (data: { message: string }) => {
            webRTC.stopStatsMonitor();
            webRTC.unregisterDeviceChange();
            webRTC.cleanup();
            if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
            clearConnectTimeout();
            reconnectingRef.current = false;
            qualityCb.onReconnect(false);
            dispatch({ type: 'SET_ERROR', payload: { message: data.message } });
            setTimeout(() => dispatch({ type: 'RESET' }), 3000);
        };

        socket.on('call:incoming', onIncoming);
        socket.on('call:accepted', onAccepted);
        socket.on('call:offer', onOffer);
        socket.on('call:answer', onAnswer);
        socket.on('call:ice-candidate', onIceCandidate);
        socket.on('call:ended', onEnded);
        socket.on('call:balance-exhausted', onBalanceExhausted);
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
            socket.off('call:balance-exhausted', onBalanceExhausted);
            socket.off('call:rejected', onRejected);
            socket.off('call:busy', onBusy);
            socket.off('call:cancelled', onCancelled);
            socket.off('call:error', onError);
        };
    }, [socket, dispatch, webRTC, emit, getIceCandidateSender, handleIceConnectionChange, startConnectTimeout, clearConnectTimeout, endCall, qualityCb]);

    return { startCall, acceptCall, rejectCall, endCall, cancelCall, setStateRef: (s: CallState) => { stateRef.current = s; } };
}
