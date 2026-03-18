import { NextRequest, NextResponse } from 'next/server';
import { openai } from '@/lib/openai';
import { MAX_FILE_SIZE_BYTES, ALLOWED_FILE_EXTENSIONS } from '@/lib/constants';
import { getUserIdentity } from '@/lib/auth';
import type { UploadStats } from '@/types';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
    try {
        const userId = getUserIdentity(request);
        const formData = await request.formData();
        const files = formData.getAll('files') as File[];

        if (!files || files.length === 0) {
            return NextResponse.json({ error: 'No files provided' }, { status: 400 });
        }

        // Validate file sizes and types
        const fileAuditInfo = files.map(f => `${f.name} (${(f.size / 1024).toFixed(1)} KB)`);
        console.log(`[AUDIT] [upload] User "${userId}" initiated upload for ${files.length} files: ${fileAuditInfo.join(', ')}`);

        for (const file of files) {
            if (file.size > MAX_FILE_SIZE_BYTES) {
                console.warn(`[AUDIT] [REJECTED] [upload] User "${userId}" tried to upload "${file.name}" — exceeds size limit (${(file.size / 1024 / 1024).toFixed(2)}MB > ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB)`);
                return NextResponse.json(
                    { error: `File "${file.name}" exceeds maximum size of ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB` },
                    { status: 400 }
                );
            }
            const ext = '.' + file.name.split('.').pop()?.toLowerCase();
            if (!ALLOWED_FILE_EXTENSIONS.includes(ext as typeof ALLOWED_FILE_EXTENSIONS[number])) {
                console.warn(`[AUDIT] [REJECTED] [upload] User "${userId}" tried to upload "${file.name}" — unsupported extension "${ext}"`);
                return NextResponse.json(
                    { error: `File "${file.name}" has unsupported extension. Allowed: ${ALLOWED_FILE_EXTENSIONS.join(', ')}` },
                    { status: 400 }
                );
            }
        }

        console.log(`[upload] Starting upload of ${files.length} files to OpenAI storage`);

        const uploadedFileIds: string[] = [];
        const errors: string[] = [];

        const uploadPromises = files.map(async (file) => {
            try {
                const fileUploadResponse = await openai.files.create({
                    file: file,
                    purpose: 'assistants',
                });
                uploadedFileIds.push(fileUploadResponse.id);
                console.log(`[upload] Uploaded: ${file.name} (${fileUploadResponse.id})`);
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                console.error(`[upload] Failed: ${file.name}:`, msg);
                errors.push(`Failed to upload '${file.name}': ${msg}`);
            }
        });

        await Promise.all(uploadPromises);

        if (uploadedFileIds.length === 0) {
            return NextResponse.json(
                { success: false, message: 'No files were uploaded successfully.', errors },
                { status: 500 }
            );
        }

        let vectorStoreId = "";
        try {
            console.log("[upload] Creating vector store...");
            const vectorStore = await openai.vectorStores.create({
                name: "Document Assistant Vector Store"
            });
            vectorStoreId = vectorStore.id;

            console.log(`[upload] Attaching files to vector store ${vectorStoreId}...`);
            await openai.vectorStores.fileBatches.createAndPoll(
                vectorStoreId,
                { file_ids: uploadedFileIds }
            );
            console.log("[upload] Vector store ready");
        } catch (vsError: unknown) {
            const msg = vsError instanceof Error ? vsError.message : String(vsError);
            console.error("[upload] Vector store creation failed:", msg);
            errors.push(`Vector store creation failed: ${msg}`);
        }

        console.log(`[AUDIT] [upload] User "${userId}" successfully processed ${uploadedFileIds.length} files into Vector Store: ${vectorStoreId}`);

        const stats: UploadStats = {
            total_files_submitted: files.length,
            successful_uploads: uploadedFileIds.length,
            success: uploadedFileIds.length > 0 && vectorStoreId !== "",
            failed: errors.length,
            uploaded_file_ids: uploadedFileIds,
            vector_store_id: vectorStoreId,
            errors: errors
        };

        return NextResponse.json(stats);

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("[upload] Error:", msg);
        return NextResponse.json(
            { error: "Failed to process upload", details: msg },
            { status: 500 }
        );
    }
}
