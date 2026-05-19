'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SourceModalData } from '@/types';

interface SourceProofModalProps {
  sourceModal: SourceModalData | null;
  onClose: () => void;
}

export function SourceProofModal({ sourceModal, onClose }: SourceProofModalProps) {
  return (
    <AnimatePresence>
      {sourceModal && (
        <>
          <motion.div
            key="source-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
          />
          <motion.div
            key="source-panel"
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 24 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="pointer-events-auto w-full max-w-2xl max-h-[85vh] flex flex-col bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/30 dark:border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200/60 dark:border-slate-700/60 bg-gradient-to-r from-[var(--color-primary)]/5 to-transparent shrink-0">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[var(--color-primary)] text-[20px]" aria-hidden="true">format_quote</span>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 tracking-wide">Source Reasoning & Proof</h3>
                </div>
                <button aria-label="Close modal" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]">
                  <span className="material-symbols-outlined text-slate-500 text-[20px]" aria-hidden="true">close</span>
                </button>
              </div>

              {/* Content */}
              <div className="px-5 py-4 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                {sourceModal.sourceReasoning ? (
                  <>
                    {/* Primary Sources */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><span className="material-symbols-outlined text-[14px]">library_books</span> Primary Sources</h4>
                      {sourceModal.sourceReasoning.primary_sources?.map((src: any, i: number) => (
                        <div key={i} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3 space-y-2">
                          <div className="flex justify-between items-start">
                            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{src.document}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${src.confidence === 'high' ? 'text-green-600 bg-green-50 border-green-200 dark:bg-green-900/20' : src.confidence === 'medium' ? 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-900/20' : 'text-red-600 bg-red-50 border-red-200 dark:bg-red-900/20'}`}>
                              {src.confidence?.toUpperCase()} CONFIDENCE
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                            <div><span className="font-semibold text-slate-500">Page:</span> {src.page}</div>
                            <div><span className="font-semibold text-slate-500">Section:</span> {src.section}</div>
                            {src.table && src.table.toLowerCase() !== 'null' && <div className="col-span-2"><span className="font-semibold text-slate-500">Table:</span> {src.table}</div>}
                            <div className="col-span-2"><span className="font-semibold text-slate-500">Location:</span> {src.location_details}</div>
                            {src.reason && <div className="col-span-2 mt-1 italic text-slate-500 border-l-2 border-slate-300 dark:border-slate-600 pl-2">&quot;{src.reason}&quot;</div>}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Methodology */}
                    {sourceModal.sourceReasoning.extraction_method && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><span className="material-symbols-outlined text-[14px]">manage_search</span> Extraction Method</h4>
                        <p className="text-sm text-slate-700 dark:text-slate-300 bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-800/30 leading-relaxed">{sourceModal.sourceReasoning.extraction_method}</p>
                      </div>
                    )}
                    
                    {/* Verification Notes */}
                    {sourceModal.sourceReasoning.verification_notes && (
                      <div className="space-y-2">
                         <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><span className="material-symbols-outlined text-[14px]">verified</span> Verification Notes</h4>
                         <p className="text-sm text-slate-700 dark:text-slate-300 bg-green-50/50 dark:bg-green-900/10 p-3 rounded-lg border border-green-100 dark:border-green-800/30 leading-relaxed">{sourceModal.sourceReasoning.verification_notes}</p>
                      </div>
                    )}

                    {/* Ambiguities */}
                    {sourceModal.sourceReasoning.ambiguities && sourceModal.sourceReasoning.ambiguities !== "None" && !sourceModal.sourceReasoning.ambiguities.toLowerCase().startsWith("none") && (
                      <div className="space-y-2">
                         <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><span className="material-symbols-outlined text-[14px]">help</span> Ambiguities & Assumptions</h4>
                         <p className="text-sm text-slate-700 dark:text-slate-300 bg-amber-50/50 dark:bg-amber-900/10 p-3 rounded-lg border border-amber-100 dark:border-amber-800/30 leading-relaxed">{sourceModal.sourceReasoning.ambiguities}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {/* Old simple quote layout fallback */}
                    <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 italic border-l-3 border-[var(--color-primary)]/40 pl-4 mb-4">
                      &ldquo;{sourceModal.quote}&rdquo;
                    </p>
                    <div className="border-t border-slate-200/60 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-800/40 grid grid-cols-3 gap-3 text-[11px] p-3 rounded-lg">
                      <div>
                        <span className="block font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">File</span>
                        <span className="text-slate-700 dark:text-slate-300 font-medium">{sourceModal.file}</span>
                      </div>
                      <div>
                        <span className="block font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Section</span>
                        <span className="text-slate-700 dark:text-slate-300 font-medium">{sourceModal.section}</span>
                      </div>
                      <div>
                        <span className="block font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Page</span>
                        <span className="text-slate-700 dark:text-slate-300 font-medium">{sourceModal.page}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
