import { CallHistoryPage } from '../../call/components/CallHistoryPage';

export default function CallHistoryRoute() {
    return <CallHistoryPage onClose={() => window.history.back()} />;
}
