"use client"

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { extractPrompts } from '@/utils/promptLoader'
import { Chatbot } from '@/components/Chatbot'
import { PipelineTestUI } from '@/components/PipelineTestUI'
import { SourceProofModal } from '@/components/SourceProofModal'
import { ExtractionCard } from '@/components/ExtractionCard'
import { useToast } from '@/components/Toast'
import { useFileUploader } from '@/hooks/useFileUploader'
import { useExtractionPipeline } from '@/hooks/useExtractionPipeline'
import type { SourceModalData } from '@/types'

// Animation variants (framer-motion-animator skill)
const fadeInDown = {
  hidden: { opacity: 0, y: -12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
}

const slideInLeft = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.45, ease: 'easeOut' as const } },
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.1 },
  },
}

const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } },
}

export default function Dashboard() {
  const { showToast } = useToast()
  const [readabilityLevel, setReadabilityLevel] = useState("6th Grade")
  const [mappingName, setMappingName] = useState("results_PLS")
  const [user, setUser] = useState<{ name: string; email: string } | null>(null)
  const [sourceModal, setSourceModal] = useState<SourceModalData | null>(null)
  const [showTestUI, setShowTestUI] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    // Fetch user info from Azure Easy Auth
    const fetchUser = async () => {
      try {
        const response = await fetch('/.auth/me');
        if (!response.ok) return;
        const data = await response.json();
        if (data && data[0]) {
          const userClaims = data[0].user_claims || [];
          const nameClaim = userClaims.find((c: { typ: string; val: string }) =>
            c.typ === 'name' || c.typ === 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'
          );
          const emailClaim = userClaims.find((c: { typ: string; val: string }) =>
            c.typ === 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'
          );
          setUser({
            name: nameClaim?.val || data[0].user_id?.split('@')[0] || 'User',
            email: emailClaim?.val || data[0].user_id || ''
          });

          // Log session start
          fetch('/api/audit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: 'SESSION_STARTED', details: { userAgent: navigator.userAgent } })
          }).catch(() => {});
        }
      } catch {
        // Expected in local dev — Easy Auth not available
      }
    };
    fetchUser();
  }, []);

  // Dynamic prompts derived from selection
  // ⚡ Bolt: Memoize prompt extraction to avoid re-parsing on every render.
  const promptData = useMemo(() => extractPrompts(readabilityLevel, mappingName), [readabilityLevel, mappingName])
  const keys = promptData.keys;
  const texts = promptData.texts;
  const mapping = promptData.mapping;

  const [selectedPrompts, setSelectedPrompts] = useState<Record<string, boolean>>({})

  useEffect(() => {
    // Select all prompts by default when mapping changes
    const newSelections: Record<string, boolean> = {}
    keys.forEach(k => newSelections[k] = true)
    setSelectedPrompts(newSelections)
  }, [mappingName]) // omitting keys dependency to avoid infinite loop on object identity change

  // File uploader hook
  const uploader = useFileUploader({ onToast: showToast });

  // Extraction pipeline hook
  const pipeline = useExtractionPipeline({
    vectorStoreId: uploader.vectorStoreId,
    keys,
    texts,
    selectedPrompts,
    onToast: showToast,
  });

  const generateReport = async () => {
    setIsGenerating(true);
    const genStartTime = Date.now();
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parsedData: currentFetchedAnswers, mappingName })
      });

      if (res.ok) {
        const blob = await res.blob();

        const contentDisposition = res.headers.get('Content-Disposition');
        let filename = "Generated_Documents.zip";
        if (contentDisposition) {
          const match = contentDisposition.match(/filename="(.+)"/);
          if (match && match[1]) {
            filename = match[1];
          }
        }

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();

        // Log time-spent from upload to final document
        const totalTimeSeconds = uploader.uploadStartTimeRef.current
          ? Math.round((Date.now() - uploader.uploadStartTimeRef.current) / 1000)
          : null;
        const genTimeSeconds = Math.round((Date.now() - genStartTime) / 1000);
        fetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'REPORT_GENERATED',
            details: {
              mappingName,
              generationTimeSec: genTimeSeconds,
              totalPipelineTimeSec: totalTimeSeconds,
              filename
            }
          })
        }).catch(() => {});
      } else {
        showToast("Report generation failed.", 'error');
      }
    } catch (e) {
      console.error(e);
      showToast("Error generating report", 'error');
    } finally {
      setIsGenerating(false);
    }
  }

  // ⚡ Bolt: Memoize fetched answers and optimize reduce from O(n²) to O(n) by mutating accumulator.
  const currentFetchedAnswers = useMemo(() => {
    return pipeline.extractionFeed
      .filter(f => f.status === 'COMPLETED' && f.parsedObj)
      .reduce((acc: Record<string, any>, feed) => {
        const keyIndex = keys.indexOf(feed.title);
        let finalKey = feed.title;
        if (keyIndex !== -1) {
          const m = mapping[String(keyIndex + 1) as keyof typeof mapping] as any;
          if (m) {
            if (m.placeholder) finalKey = m.placeholder;
            else if (m.table_placeholder) finalKey = m.table_placeholder.replace(/^{{/, '').replace(/}}$/, '');
          }
        }
        acc[finalKey] = feed.parsedObj;
        return acc;
      }, {});
  }, [pipeline.extractionFeed, keys, mapping]);

  // ⚡ Bolt: Stabilize chatbot update callback to prevent unnecessary child component re-renders.
  const handleChatbotUpdate = useCallback((keyToUpdate: string, newValue: any) => {
    pipeline.setExtractionFeed(prev => prev.map(feed => {
      const keyIndex = keys.indexOf(feed.title);
      let finalKey = feed.title;
      if (keyIndex !== -1) {
        const m = mapping[String(keyIndex + 1) as keyof typeof mapping] as any;
        if (m) {
          if (m.placeholder) finalKey = m.placeholder;
          else if (m.table_placeholder) finalKey = m.table_placeholder.replace(/^{{/, '').replace(/}}$/, '');
        }
      }

      if (finalKey === keyToUpdate) {
        return {
          ...feed,
          parsedObj: newValue,
          data: typeof newValue === 'object' ? JSON.stringify(newValue, null, 2) : String(newValue)
        };
      }
      return feed;
    }));
  }, [pipeline.setExtractionFeed, keys, mapping]);

  return (
    <div className="flex flex-col h-full w-full relative gradient-mesh">
      {/* ─── Header ─── */}
      <motion.header
        variants={fadeInDown}
        initial="hidden"
        animate="visible"
        className="flex items-center justify-between border-b border-[var(--color-border-light)] dark:border-[var(--color-border-dark)] bg-[var(--color-surface-light)] dark:bg-[var(--color-surface-dark)] px-6 py-3 shrink-0 glass"
      >
        <div className="flex items-center gap-6">
          <img src="/krystelis_logo.svg" alt="Krystelis Logo" className="h-10 w-auto object-contain" />
          <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700">
            <span className="material-symbols-outlined text-[13px] text-slate-500">bolt</span>
            <span className="text-[11px] font-semibold text-slate-500 tracking-wide uppercase">Powered by OpenAI</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {user && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg text-xs font-semibold text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50">
              <span className="material-symbols-outlined text-[16px]">person</span>
              Hi, {user.name}
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            System Online
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowTestUI(true)}
            className="flex items-center gap-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-lg">science</span>
            <span>Test Pipeline</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={generateReport}
            disabled={isGenerating}
            className="flex items-center gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm disabled:opacity-50"
          >
            {isGenerating ? (
              <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
            ) : (
              <span className="material-symbols-outlined text-lg">description</span>
            )}
            <span>{isGenerating ? "Generating..." : "Generate Word Document"}</span>
          </motion.button>
        </div>
      </motion.header>

      <div className="flex flex-1 overflow-hidden">
        {/* ─── Left Sidebar ─── */}
        <motion.aside
          variants={slideInLeft}
          initial="hidden"
          animate="visible"
          className="w-96 border-r border-[var(--color-border-light)] dark:border-[var(--color-border-dark)] bg-[var(--color-surface-light)] dark:bg-[var(--color-surface-dark)] flex flex-col shrink-0 overflow-y-auto custom-scrollbar"
        >
          <div className="p-6 flex flex-col gap-6">

            {/* Configuration */}
            <div className="space-y-4 border-b border-slate-200 dark:border-slate-800 pb-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Configuration</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Mapping Profile</label>
                  <select
                    value={mappingName}
                    onChange={(e) => setMappingName(e.target.value)}
                    className="w-full rounded-md border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm p-2 outline-none focus:border-[var(--color-primary)]"
                  >
                    <option value="results_PLS">Results PLS</option>
                    <option value="protocol_PLS">Protocol PLS</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Readability Level</label>
                  <select
                    value={readabilityLevel}
                    onChange={(e) => setReadabilityLevel(e.target.value)}
                    className="w-full rounded-md border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm p-2 outline-none focus:border-[var(--color-primary)]"
                  >
                    <option value="2nd Grade">2nd Grade</option>
                    <option value="4th Grade">4th Grade</option>
                    <option value="6th Grade">6th Grade</option>
                    <option value="Non-technical Healthcare Professional">Non-technical Healthcare Professional</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Upload Zone */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Workspace</h3>
              <div
                onClick={() => uploader.fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-6 flex flex-col items-center justify-center gap-2 hover:border-[var(--color-primary)]/50 cursor-pointer transition-colors bg-slate-50 dark:bg-slate-800/50"
              >
                <input
                  type="file"
                  multiple
                  className="hidden"
                  ref={uploader.fileInputRef}
                  onChange={uploader.handleFileSelect}
                  accept=".pdf,.docx,.txt"
                />
                <span className="material-symbols-outlined text-3xl text-[var(--color-primary)]">
                  note_add
                </span>
                <div className="text-center text-sm">
                  <p className="font-medium text-slate-900 dark:text-white">
                    Select Documents
                  </p>
                  <p className="text-slate-500 text-xs mt-1">Add files to queue</p>
                </div>
              </div>

              {uploader.queuedFiles.length > 0 && (
                <button
                  onClick={uploader.uploadToVectorStore}
                  disabled={uploader.isUploading}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {uploader.isUploading ? (
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                  ) : (
                    <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
                  )}
                  {uploader.isUploading ? "Uploading..." : `Upload ${uploader.queuedFiles.length} File${uploader.queuedFiles.length > 1 ? 's' : ''} to Vector Store`}
                </button>
              )}

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={pipeline.runExtraction}
                disabled={uploader.isUploading || !uploader.vectorStoreId || pipeline.isExtracting || uploader.queuedFiles.length > 0}
                className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm"
              >
                {pipeline.isExtracting ? "Extracting..." : "Run AI Extraction"}
              </motion.button>
            </div>

            {/* AI Prompts Checklist */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[var(--color-primary)] text-xl">lightbulb</span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">AI Prompts</h3>
                </div>
                <button
                  onClick={() => {
                    const allSelected = keys.every(k => selectedPrompts[k]);
                    const newSelections: Record<string, boolean> = {};
                    keys.forEach(k => newSelections[k] = !allSelected);
                    setSelectedPrompts(newSelections);
                  }}
                  className="text-xs text-[var(--color-primary)] hover:underline font-medium">
                  Toggle All
                </button>
              </div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                {keys.map(key => (
                  <label key={key} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 cursor-pointer border border-transparent hover:border-[var(--color-primary)]/20 group">
                    <span className="text-[13px] font-medium text-slate-700 dark:text-slate-300 truncate pr-2">{key.replace(/_/g, ' ')}</span>
                    <input
                      checked={!!selectedPrompts[key]}
                      onChange={(e) => setSelectedPrompts({ ...selectedPrompts, [key]: e.target.checked })}
                      className="rounded border-slate-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)] h-3.5 w-3.5"
                      type="checkbox"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Uploaded Files List */}
            {(uploader.queuedFiles.length > 0 || uploader.files.length > 0) && (
              <div className="space-y-4 border-t border-slate-200 dark:border-slate-800 pt-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Files</h3>
                <div className="space-y-2">
                  {uploader.queuedFiles.map((file, idx) => (
                    <div key={`q-${idx}`} className={`flex items-center gap-3 p-3 rounded-lg border border-dashed border-amber-300 dark:border-amber-700/50 bg-amber-50/50 dark:bg-amber-900/10`}>
                      <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-lg flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined">{file.name.endsWith('.pdf') ? "description" : "receipt_long"}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{file.name}</p>
                        <p className="text-xs text-amber-600/70">{(file.size / 1024 / 1024).toFixed(2)} MB • Queued</p>
                      </div>
                      <button onClick={() => uploader.removeQueuedFile(file.name)} className="text-slate-400 hover:text-red-500 transition-colors p-1" title="Remove file">
                        <span className="material-symbols-outlined text-lg block">close</span>
                      </button>
                    </div>
                  ))}

                  {uploader.files.map((file, idx) => (
                    <div key={`f-${idx}`} className={`flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800 ${file.opacity}`}>
                      <div className="w-10 h-10 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-lg flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined">{file.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{file.name}</p>
                        <p className="text-xs text-slate-500">{file.size} • {file.status}</p>
                      </div>
                      <span className={`material-symbols-outlined ${file.statusColor} text-xl`}>{file.statusIcon}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.aside>

        {/* ─── Main Workspace ─── */}
        <main className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 flex flex-col gap-3 shadow-sm z-10">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-[var(--color-primary)]">edit_document</span>
                AI Extraction & Refinement Feed
              </h2>
              <div className="flex items-center gap-3">
                {pipeline.extractionTimeMs > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-md text-slate-600 dark:text-slate-300 text-xs font-mono font-medium">
                    <span className="material-symbols-outlined text-[14px]">timer</span>
                    {pipeline.formatTime(pipeline.extractionTimeMs)}
                  </div>
                )}
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] italic">Live Interactive Document</span>
              </div>
            </div>

            {/* Progress Bar */}
            {(pipeline.isExtracting || (pipeline.extractionProgress === 100 && pipeline.extractionFeed.length > 0)) && (
              <div className="w-full space-y-1.5">
                <div className="flex justify-between items-center text-xs font-medium text-slate-500">
                  <span>{pipeline.isExtracting ? 'Extracting Data...' : 'Extraction Complete'}</span>
                  <span>{pipeline.extractionProgress}%</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <motion.div
                    className={`bg-[var(--color-primary)] h-1.5 rounded-full ${pipeline.isExtracting ? 'progress-glow' : ''}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${pipeline.extractionProgress}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="max-w-4xl mx-auto space-y-6"
            >
              {pipeline.extractionFeed.length === 0 ? (
                <motion.div
                  variants={staggerItem}
                  className="flex flex-col items-center justify-center h-64 text-slate-500 border-2 border-dashed border-[var(--color-border-light)] dark:border-[var(--color-border-dark)] rounded-xl"
                >
                  <span className="material-symbols-outlined text-4xl mb-2 text-slate-300 dark:text-slate-600">article</span>
                  <p className="text-sm font-medium">Run AI Extraction to begin building the document.</p>
                </motion.div>
              ) : (
                pipeline.extractionFeed.map((feed, idx) => (
                  <ExtractionCard
                    key={idx}
                    feed={feed}
                    idx={idx}
                    refiningKey={pipeline.refiningKey}
                    refineInstructions={pipeline.refineInstructions}
                    onSetRefineInstructions={(key, val) => pipeline.setRefineInstructions(prev => ({ ...prev, [key]: val }))}
                    onRefine={pipeline.handleRefine}
                    onUpdateFeed={(title, newVal) => {
                      pipeline.setExtractionFeed(prev => prev.map(f =>
                        f.title === title ? { ...f, parsedObj: newVal, data: typeof newVal === 'object' ? JSON.stringify(newVal, null, 2) : String(newVal) } : f
                      ));
                    }}
                    onViewSource={setSourceModal}
                  />
                ))
              )}
            </motion.div>
          </div>
        </main>
      </div>

      {/* Source Proof Modal */}
      <SourceProofModal sourceModal={sourceModal} onClose={() => setSourceModal(null)} />

      {/* Pipeline Test UI Modal */}
      <AnimatePresence>
        {showTestUI && (
          <PipelineTestUI onClose={() => setShowTestUI(false)} />
        )}
      </AnimatePresence>

      {/* Floating Chatbot Widget */}
      <Chatbot
        vectorStoreId={uploader.vectorStoreId}
        fetchedAnswers={currentFetchedAnswers}
        onUpdateData={handleChatbotUpdate}
      />
    </div>
  )
}
