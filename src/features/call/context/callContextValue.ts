import { createContext, useContext } from 'react';
import type { CallState } from '../types/call';

export interface CallContextProps {
    callState: CallState;
    peerStream: MediaStream | null;
    isMuted: boolean;
    isSpeakerOn: boolean;
    startCall: (peerId: number, peerName: string) => Promise<void>;
    acceptCall: () => void;
    rejectCall: () => void;
    endCall: () => void;
    cancelCall: () => void;
    toggleMute: () => void;
    toggleSpeaker: () => void;
}

export const CallContext = createContext<CallContextProps | undefined>(undefined);

export const useCallContext = (): CallContextProps => {
    const context = useContext(CallContext);
    if (!context) {
        throw new Error('useCallContext must be used within a CallProvider');
    }
    return context;
};
