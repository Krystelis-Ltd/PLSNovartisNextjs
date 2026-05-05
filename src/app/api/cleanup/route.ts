import { NextRequest, NextResponse } from 'next/server';
import { cleanupStaleVectorStores } from '@/lib/vector-store-cleanup';
import { getUserIdentity } from '@/lib/auth';
import { auditLog } from '@/lib/audit-logger';

export const maxDuration = 300;

/**
 * POST /api/cleanup
 * 
 * Triggers cleanup of stale OpenAI vector stores and files.
 * 
 * Query params:
 *   maxAgeHours - Maximum age in hours before a store is deleted (default: 24)
 * 
 * Security: Protected by the same auth as other API routes.
 * Can be triggered manually or via an Azure Timer Trigger / cron job
 * hitting this endpoint with a shared secret.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdentity(request);
    
    // Parse max age from query or body
    const { searchParams } = new URL(request.url);
    const maxAgeHours = parseInt(searchParams.get('maxAgeHours') || '24', 10);

    // Optional: check for cleanup secret to allow cron jobs
    const authHeader = request.headers.get('x-cleanup-secret');
    const cleanupSecret = process.env.CLEANUP_SECRET;
    if (cleanupSecret && authHeader !== cleanupSecret) {
      // If a secret is configured, require it
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    auditLog({
      request,
      action: 'VECTOR_STORE_CLEANUP',
      resource: { type: 'API', path: '/api/cleanup' },
      status: { code: 200, result: 'SUCCESS' },
      details: { maxAgeHours, triggeredBy: userId }
    });

    console.log(`[cleanup] Starting cleanup, maxAgeHours=${maxAgeHours}`);
    const result = await cleanupStaleVectorStores(maxAgeHours);

    return NextResponse.json({
      success: true,
      ...result,
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[cleanup] Error:', msg);
    auditLog({
      request,
      action: 'SYSTEM_ERROR',
      resource: { type: 'API', path: '/api/cleanup' },
      status: { code: 500, result: 'FAILURE' },
      details: { error: msg }
    });
    return NextResponse.json(
      { error: 'Cleanup failed', details: msg },
      { status: 500 }
    );
  }
}
