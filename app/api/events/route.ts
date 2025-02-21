import { NextResponse } from "next/server";
import { Event } from '@/types/events';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const runId = searchParams.get('runId');

    if (!runId) {
        return NextResponse.json({ error: "Run ID required" }, { status: 400 });
    }

    const eventsResponse = await fetch(
        `https://cloud.griptape.ai/api/structure-runs/${runId}/events`,
        {
            headers: {
                "Authorization": `Bearer ${process.env.GRIPTAPE_CLOUD_API_KEY}`,
            }
        }
    );

    const eventsData: { events: Event[] } = await eventsResponse.json();

    // Transform the events to include the full payload
    const events = eventsData.events.map((event: Event) => ({
        ...event,
        payload: event.payload // This will now include the full payload object
    }));

    return NextResponse.json({
        ...eventsData,
        events
    });
} 