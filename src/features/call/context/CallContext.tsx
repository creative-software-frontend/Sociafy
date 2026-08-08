import React, { useEffect, useReducer, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useWebRTC } from '../hooks/useWebRTC';
import { useCallManager } from '../hooks/useCallManager';
import { useCallAudio } from '../hooks/useCallAudio';
import { SOCKET_URL } from '../../../config/apiConfig';
import { callReducer, INITIAL_CALL_STATE } from '../types/call';
import { CallContext } from './callContextValue';
import type { CallQuality, CallStats } from '../types/call';
import { IncomingCallOverlay } from '../components/IncomingCallOverlay';
import { CallUI } from '../components/CallUI';

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [callState, dispatch] = useReducer(callReducer, INITIAL_CALL_STATE);
    const [isMuted, setIsMuted] = useState(false);
    const [isSpeakerOn, setIsSpeakerOn] = useState(false);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [connectionQuality, setConnectionQuality] = useState<CallQuality>(null);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [connectionLost, setConnectionLost] = useState(false);
    const [lastStats, setLastStats] = useState<CallStats | null>(null);

    const webRTC = useWebRTC();

    const onQuality = useCallback((quality: CallQuality) => setConnectionQuality(quality), []);
    const onReconnect = useCallback((reconnecting: boolean) => setIsReconnecting(reconnecting), []);
    const onConnectionLost = useCallback((lost: boolean) => setConnectionLost(lost), []);

    const manager = useCallManager(socket, dispatch, webRTC, { onQuality, onReconnect, onConnectionLost });
    useCallAudio(callState.status, callState.direction);

    useEffect(() => {
        const token = localStorage.getItem('bluedise_token');
        if (!token) return;

        const backendUrl = SOCKET_URL;
        const s = io(backendUrl, {
            auth: { token },
            transports: ['websocket'],
        });
        setSocket(s);

        return () => {
            s.disconnect();
            webRTC.cleanup();
        };
    }, []);

    useEffect(() => {
        manager.setStateRef(callState);
    }, [callState, manager]);

    // Start stats monitor + device change when connected
    useEffect(() => {
        if (callState.status === 'connected') {
            setConnectionQuality(null);
            setIsReconnecting(false);
            setConnectionLost(false);
            webRTC.startStatsMonitor((stats) => {
                setLastStats(stats);
                setConnectionQuality(stats.quality);
            });
            webRTC.registerDeviceChange(() => {
                // Notify by toggling reconnect indicator briefly
                setIsReconnecting(true);
                setTimeout(() => setIsReconnecting(false), 3000);
            });
        } else if (callState.status === 'idle' || ['ended', 'busy', 'rejected', 'cancelled', 'missed', 'error'].includes(callState.status)) {
            webRTC.stopStatsMonitor();
            webRTC.unregisterDeviceChange();
            setConnectionQuality(null);
            setIsReconnecting(false);
            setConnectionLost(false);
            setLastStats(null);
        }
    }, [callState.status, webRTC]);

    const toggleMute = useCallback(() => {
        const muted = !webRTC.toggleMute();
        setIsMuted(muted);
    }, [webRTC]);

    const toggleSpeaker = useCallback(() => {
        setIsSpeakerOn(prev => !prev);
    }, []);

    const startCall = useCallback(async (peerId: number, peerName: string) => {
        await manager.startCall(peerId, peerName);
    }, [manager]);

    const acceptCall = useCallback(() => {
        manager.acceptCall();
    }, [manager]);

    const rejectCall = useCallback(() => {
        manager.rejectCall();
    }, [manager]);

    const endCall = useCallback(() => {
        manager.endCall();
    }, [manager]);

    const cancelCall = useCallback(() => {
        manager.cancelCall();
    }, [manager]);

    const showIncoming = callState.status === 'incoming';
    const showCallUI = callState.status !== 'idle' && callState.status !== 'incoming';

    return (
        <CallContext.Provider
            value={{
                callState,
                peerStream: webRTC.peerStream,
                isMuted,
                isSpeakerOn,
                connectionQuality,
                isReconnecting,
                connectionLost,
                lastStats,
                startCall,
                acceptCall,
                rejectCall,
                endCall,
                cancelCall,
                toggleMute,
                toggleSpeaker,
            }}
        >
            {children}
            {showIncoming && <IncomingCallOverlay />}
            {showCallUI && <CallUI />}
        </CallContext.Provider>
    );
};
