import React, { useEffect, useReducer, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useWebRTC } from '../hooks/useWebRTC';
import { useCallManager } from '../hooks/useCallManager';
import { callReducer, INITIAL_CALL_STATE } from '../types/call';
import { CallContext } from './callContextValue';
import { IncomingCallOverlay } from '../components/IncomingCallOverlay';
import { CallUI } from '../components/CallUI';

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [callState, dispatch] = useReducer(callReducer, INITIAL_CALL_STATE);
    const [isMuted, setIsMuted] = useState(false);
    const [isSpeakerOn, setIsSpeakerOn] = useState(false);
    const [socket, setSocket] = useState<Socket | null>(null);

    const webRTC = useWebRTC();

    const manager = useCallManager(socket, dispatch, webRTC);

    useEffect(() => {
        const token = localStorage.getItem('bluedise_token');
        if (!token) return;

        const backendUrl = import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || 'http://localhost:5000';
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
