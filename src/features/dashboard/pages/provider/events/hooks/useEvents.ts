import { useState, useEffect, useCallback } from 'react';
import { eventApi } from '../../../../../../utils/api';
import type { Event } from '../types/event';
import { useToast } from '../../../../../../components/Toast';

export function useEvents(role: string) {
    const toast = useToast();
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<number | null>(null); // tracks event ID being modified

    const fetchEvents = useCallback(async () => {
        setLoading(true);
        setError(null);
        // Providers: "Browse Events" and "My Events" are separate DB-driven
        // membership features, so we fetch both lists independently.
        if (role === 'provider') {
            const [browseRes, mineRes] = await Promise.all([
                eventApi.getProviderBrowseEvents(),
                eventApi.getProviderMyEvents(),
            ]);
            if (browseRes.error && browseRes.status !== 403) {
                setError(browseRes.error);
            }
            // Merge both lists (mine is a subset of browse, but keep both for tab filtering)
            const browse = browseRes.data || [];
            const mine = mineRes.data || [];
            const merged = [...browse];
            const seen = new Set(browse.map((e: Event) => e.id));
            for (const e of mine) {
                if (!seen.has(e.id)) merged.push(e);
            }
            setEvents(merged);
        } else {
            const res = await eventApi.getEvents(role);
            if (res.error) {
                setError(res.error);
            } else {
                setEvents(res.data || []);
            }
        }
        setLoading(false);
    }, [role]);

    useEffect(() => {
        fetchEvents();
    }, [fetchEvents]);

    const joinEvent = useCallback(async (eventId: number) => {
        setActionLoading(eventId);
        const res = await eventApi.joinEvent(eventId);
        if (!res.error) {
            // refresh events
            await fetchEvents();
        }
        setActionLoading(null);
        return res;
    }, [fetchEvents]);

    const leaveEvent = useCallback(async (eventId: number) => {
        setActionLoading(eventId);
        const res = await eventApi.leaveEvent(eventId);
        if (res.error) {
            toast.error(res.error);
        } else {
            // refresh events
            await fetchEvents();
        }
        setActionLoading(null);
    }, [fetchEvents, toast]);

    const deleteEvent = useCallback(async (eventId: number) => {
        setActionLoading(eventId);
        const res = await eventApi.deleteEvent(eventId);
        if (!res.error) {
            // refresh events
            await fetchEvents();
        }
        setActionLoading(null);
        return res;
    }, [fetchEvents]);

    return {
        events,
        loading,
        error,
        actionLoading,
        refresh: fetchEvents,
        joinEvent,
        leaveEvent,
        deleteEvent
    };
}
