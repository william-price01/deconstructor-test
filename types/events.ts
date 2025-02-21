export interface Event {
    event_id: string;
    type: string;
    created_at: string;
    origin: string;
    payload: Record<string, unknown>;
} 