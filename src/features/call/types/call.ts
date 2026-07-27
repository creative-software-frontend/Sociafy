export type CallStatus =
    | 'idle'
    | 'calling'
    | 'incoming'
    | 'ringing'
    | 'connecting'
    | 'connected'
    | 'ended'
    | 'busy'
    | 'rejected'
    | 'cancelled'
    | 'missed'
    | 'error';

export type CallDirection = 'incoming' | 'outgoing' | null;

export type CallType = 'audio' | 'video';

export interface CallState {
    status: CallStatus;
    direction: CallDirection;
    peerId: number | null;
    peerName: string;
    peerRole: string | null;
    callType: CallType;
    error: string | null;
}

export type CallAction =
    | { type: 'RESET' }
    | { type: 'SET_CALLING'; payload: { peerId: number; peerName: string } }
    | { type: 'SET_INCOMING'; payload: { callerId: number; callerName: string; callType: string; callerRole?: string } }
    | { type: 'SET_RINGING' }
    | { type: 'SET_CONNECTING' }
    | { type: 'SET_CONNECTED' }
    | { type: 'SET_ENDED' }
    | { type: 'SET_BUSY' }
    | { type: 'SET_REJECTED' }
    | { type: 'SET_CANCELLED' }
    | { type: 'SET_MISSED' }
    | { type: 'SET_ERROR'; payload: { message: string } };

export const INITIAL_CALL_STATE: CallState = {
    status: 'idle',
    direction: null,
    peerId: null,
    peerName: '',
    peerRole: null,
    callType: 'audio',
    error: null,
};

export function callReducer(state: CallState, action: CallAction): CallState {
    switch (action.type) {
        case 'RESET':
            return { ...INITIAL_CALL_STATE };
        case 'SET_CALLING':
            return {
                ...INITIAL_CALL_STATE,
                status: 'calling',
                direction: 'outgoing',
                peerId: action.payload.peerId,
                peerName: action.payload.peerName,
                callType: 'audio',
            };
        case 'SET_INCOMING':
            return {
                ...INITIAL_CALL_STATE,
                status: 'incoming',
                direction: 'incoming',
                peerId: action.payload.callerId,
                peerName: action.payload.callerName,
                peerRole: action.payload.callerRole || null,
                callType: action.payload.callType === 'video' ? 'video' : 'audio',
            };
        case 'SET_RINGING':
            return { ...state, status: 'ringing' };
        case 'SET_CONNECTING':
            return { ...state, status: 'connecting' };
        case 'SET_CONNECTED':
            return { ...state, status: 'connected' };
        case 'SET_ENDED':
            return { ...state, status: 'ended' };
        case 'SET_BUSY':
            return { ...state, status: 'busy' };
        case 'SET_REJECTED':
            return { ...state, status: 'rejected' };
        case 'SET_CANCELLED':
            return { ...state, status: 'cancelled' };
        case 'SET_MISSED':
            return { ...state, status: 'missed' };
        case 'SET_ERROR':
            return { ...state, status: 'error', error: action.payload.message };
        default:
            return state;
    }
}
