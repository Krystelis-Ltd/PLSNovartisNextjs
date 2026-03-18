import { NextRequest, NextResponse } from 'next/server';
import { getUserIdentity } from '@/lib/auth';

/**
 * Lightweight audit endpoint for client-side events.
 */
export async function POST(request: NextRequest) {
    try {
        const userId = getUserIdentity(request);
        const { event, details } = await request.json();

        if (!event) {
            return NextResponse.json({ error: 'Missing event name' }, { status: 400 });
        }

        const detailsStr = details ? JSON.stringify(details) : 'No details';
        console.log(`[AUDIT] [client] User "${userId}" triggered event: "${event}". Details: ${detailsStr}`);

        return NextResponse.json({ status: 'ok' });
    } catch (error: any) {
        console.error('[audit-api] Error processing audit event:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
