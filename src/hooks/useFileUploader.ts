'use client';

import { useState, useRef } from 'react';
import type { FileEntry } from '@/types';

interface UseFileUploaderOptions {
  onToast: (msg: string, type: 'success' | 'warning' | 'error') => void;
}

export function useFileUploader({ onToast }: UseFileUploaderOptions) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [vectorStoreId, setVectorStoreId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadStartTimeRef = useRef<number | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const newFiles = Array.from(e.target.files);

    // Check for duplicates
    const uniqueNewFiles = newFiles.filter(nf =>
      !queuedFiles.some(qf => qf.name === nf.name) &&
      !files.some(f => f.name === nf.name)
    );

    setQueuedFiles(prev => [...prev, ...uniqueNewFiles]);

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeQueuedFile = (name: string) => {
    setQueuedFiles(prev => prev.filter(f => f.name !== name));
  };

  const uploadToVectorStore = async () => {
    if (queuedFiles.length === 0) return;

    setIsUploading(true);
    uploadStartTimeRef.current = Date.now();

    const newFileEntries = queuedFiles.map(f => ({
      name: f.name,
      size: (f.size / 1024 / 1024).toFixed(2) + " MB",
      status: "Uploading...",
      icon: f.name.endsWith('.pdf') ? "description" : "receipt_long",
      statusIcon: "more_horiz",
      statusColor: "text-slate-400",
      opacity: "opacity-70"
    }));

    setFiles(prev => [...prev, ...newFileEntries]);

    const formData = new FormData();
    queuedFiles.forEach(f => formData.append('files', f));

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (res.ok) {
        setVectorStoreId(data.vector_store_id);
        setQueuedFiles([]); // Clear queue on success
        setFiles(prev => prev.map(f =>
          newFileEntries.find(nf => nf.name === f.name)
            ? { ...f, status: "Processed", statusIcon: "check_circle", statusColor: "text-green-500", opacity: "" }
            : f
        ));
      } else {
        onToast("Upload failed: " + JSON.stringify(data.errors), 'error');
        setFiles(prev => prev.filter(f => !newFileEntries.find(nf => nf.name === f.name)));
      }
    } catch (err) {
      console.error(err);
      onToast("Error uploading files", 'error');
    } finally {
      setIsUploading(false);
    }
  };

  return {
    files,
    queuedFiles,
    isUploading,
    vectorStoreId,
    fileInputRef,
    uploadStartTimeRef,
    handleFileSelect,
    removeQueuedFile,
    uploadToVectorStore,
    setVectorStoreId,
  };
}
