import { useNavigate, useParams } from 'react-router-dom';
import { CallHistoryPage } from '../../call/components/CallHistoryPage';

export default function CallHistoryRoute() {
    const navigate = useNavigate();
    const { role } = useParams<{ role: string }>();
    return <CallHistoryPage onClose={() => navigate(`/${role}/dashboard/chat`)} />;
}
