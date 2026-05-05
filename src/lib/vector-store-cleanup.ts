/**
 * Vector Store Lifecycle Manager
 * 
 * Cleans up stale OpenAI vector stores and their associated files
 * to prevent accumulating storage costs on Azure/OpenAI.
 * 
 * Default: deletes vector stores older than 24 hours.
 */

import { getOpenAIClient } from '@/lib/openai';

export interface CleanupResult {
  scannedCount: number;
  deletedStores: string[];
  deletedFiles: string[];
  errors: string[];
  durationMs: number;
}

/**
 * Deletes all vector stores (and their attached files) that were created
 * more than `maxAgeHours` hours ago.
 */
export async function cleanupStaleVectorStores(
  maxAgeHours: number = 24
): Promise<CleanupResult> {
  const start = Date.now();
  const openai = getOpenAIClient();
  const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;

  const result: CleanupResult = {
    scannedCount: 0,
    deletedStores: [],
    deletedFiles: [],
    errors: [],
    durationMs: 0,
  };

  try {
    // List all vector stores (paginated)
    let hasMore = true;
    let after: string | undefined;

    while (hasMore) {
      const listParams: { limit: number; after?: string } = { limit: 100 };
      if (after) listParams.after = after;

      const stores = await openai.vectorStores.list(listParams);

      for (const store of stores.data) {
        result.scannedCount++;
        const createdAt = store.created_at * 1000; // OpenAI returns Unix seconds

        if (createdAt < cutoff) {
          console.log(`[cleanup] Deleting stale vector store: ${store.id} (created ${new Date(createdAt).toISOString()})`);

          // First, list and delete attached files
          try {
            const filesInStore = await openai.vectorStores.files.list(store.id);
            for (const vsFile of filesInStore.data) {
              try {
                // Remove from vector store
                await openai.vectorStores.files.delete(vsFile.id, { vector_store_id: store.id });
                // Delete the underlying file from OpenAI storage
                await openai.files.delete(vsFile.id);
                result.deletedFiles.push(vsFile.id);
                console.log(`[cleanup]   Deleted file: ${vsFile.id}`);
              } catch (fileErr: unknown) {
                const msg = fileErr instanceof Error ? fileErr.message : String(fileErr);
                result.errors.push(`Failed to delete file ${vsFile.id}: ${msg}`);
                console.warn(`[cleanup]   Failed to delete file ${vsFile.id}:`, msg);
              }
            }
          } catch (listErr: unknown) {
            const msg = listErr instanceof Error ? listErr.message : String(listErr);
            result.errors.push(`Failed to list files for store ${store.id}: ${msg}`);
          }

          // Delete the vector store itself
          try {
            await openai.vectorStores.delete(store.id);
            result.deletedStores.push(store.id);
            console.log(`[cleanup]   Deleted store: ${store.id}`);
          } catch (storeErr: unknown) {
            const msg = storeErr instanceof Error ? storeErr.message : String(storeErr);
            result.errors.push(`Failed to delete store ${store.id}: ${msg}`);
          }
        }
      }

      hasMore = stores.hasNextPage();
      if (stores.data.length > 0) {
        after = stores.data[stores.data.length - 1].id;
      } else {
        hasMore = false;
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Cleanup scan failed: ${msg}`);
    console.error('[cleanup] Scan failed:', msg);
  }

  result.durationMs = Date.now() - start;
  console.log(`[cleanup] Complete: scanned=${result.scannedCount}, deleted stores=${result.deletedStores.length}, deleted files=${result.deletedFiles.length}, errors=${result.errors.length}, duration=${result.durationMs}ms`);

  return result;
}
