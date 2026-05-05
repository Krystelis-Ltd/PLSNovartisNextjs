'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { JsonEditor } from '@/components/JsonEditor';
import type { ExtractionFeedItem, SourceModalData } from '@/types';

const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } },
};

interface ExtractionCardProps {
  feed: ExtractionFeedItem;
  idx: number;
  refiningKey: string | null;
  refineInstructions: Record<string, string>;
  onSetRefineInstructions: (key: string, value: string) => void;
  onRefine: (key: string, rawJson: string, instructions?: string) => void;
  onUpdateFeed: (title: string, newVal: any) => void;
  onViewSource: (data: SourceModalData) => void;
}

export function ExtractionCard({
  feed,
  idx,
  refiningKey,
  refineInstructions,
  onSetRefineInstructions,
  onRefine,
  onUpdateFeed,
  onViewSource,
}: ExtractionCardProps) {

  const renderEditableData = () => {
    if (!feed.parsedObj) return null;
    if (typeof feed.parsedObj !== 'object' || feed.parsedObj === null) return null;

    return (
      <JsonEditor
        data={feed.parsedObj}
        onUpdate={(newVal) => onUpdateFeed(feed.title, newVal)}
        onRequestAIRefine={(instructions) => {
          onRefine(feed.title, JSON.stringify(feed.parsedObj), instructions);
        }}
        isRefining={refiningKey === feed.title}
      />
    );
  };

  return (
    <motion.div
      key={idx}
      variants={staggerItem}
      layout
      className={`bg-[var(--color-surface-light)] dark:bg-[var(--color-surface-dark)] rounded-xl border border-[var(--color-border-light)] dark:border-[var(--color-border-dark)] p-5 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-shadow ${feed.status === 'FETCHING...' ? 'border-l-4 border-l-[var(--color-primary)]' : ''}`}
    >
      {/* Header Row */}
      <div className="flex justify-between items-center mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold text-[var(--color-primary)] uppercase tracking-wide flex items-center gap-2">
            {feed.title.replace(/_/g, ' ')}
          </h3>
          {feed.confidenceScore !== undefined && (
            <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${feed.confidenceScore >= 85 ? 'text-green-600 bg-green-50 border-green-200 dark:bg-green-900/20' : feed.confidenceScore >= 70 ? 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-900/20' : 'text-red-600 bg-red-50 border-red-200 dark:bg-red-900/20'}`} title="AI Confidence Score (Based on Source Alignment)">
              <span className="material-symbols-outlined text-[12px]">
                {feed.confidenceScore >= 85 ? 'verified' : 'warning'}
              </span>
              {feed.confidenceScore}% CONFIDENCE
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {(feed.sourceQuote || feed.sourceReasoning) && (
            <button
              onClick={() => onViewSource({ 
                 quote: feed.sourceQuote ?? '', 
                 file: feed.sourceFile || 'Unknown', 
                 section: feed.sourceSection || 'Unknown', 
                 page: feed.sourcePage || 'Unknown',
                 sourceReasoning: feed.sourceReasoning
              })}
              className="text-[10px] font-bold text-slate-500 hover:text-[var(--color-primary)] bg-slate-100 dark:bg-slate-800 hover:bg-[var(--color-primary)]/10 px-2.5 py-1 flex items-center gap-1 rounded transition-colors mr-2 border border-transparent hover:border-[var(--color-primary)]/20"
              title="View source reasoning"
            >
              <span className="material-symbols-outlined text-[13px]">format_quote</span>
              VIEW SOURCE
            </button>
          )}
          <StatusBadge status={feed.status} />
        </div>
      </div>

      {/* Body */}
      {feed.status === 'FETCHING...' || feed.status === 'WAITING...' || feed.status === 'REFINING...' || feed.status === 'VALIDATING...' ? (
        <div className={`space-y-3 ${feed.status === 'WAITING...' ? 'opacity-30' : ''}`}>
          <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-full skeleton-shimmer"></div>
          <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-5/6 skeleton-shimmer"></div>
          <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-4/6 skeleton-shimmer"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Primitive value: simple textarea */}
          {feed.parsedObj !== null && feed.parsedObj !== undefined && typeof feed.parsedObj !== 'object' ? (
            <>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-100 dark:border-slate-800 relative group">
                <textarea
                  className="w-full bg-transparent text-sm text-slate-700 dark:text-slate-300 resize-none outline-none min-h-[60px]"
                  value={String(feed.parsedObj)}
                  onChange={(e) => onUpdateFeed(feed.title, e.target.value)}
                  rows={feed.data ? feed.data.split('\n').length : 3}
                />
              </div>
              {/* Refine bar for primitive-only data */}
              <div className="flex gap-2 items-center bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 p-3 rounded-xl border border-indigo-100 dark:border-indigo-800/30">
                <span className="material-symbols-outlined text-indigo-500 text-lg shrink-0">auto_awesome</span>
                <input
                  type="text"
                  placeholder="Optional: instructions for AI refinement"
                  className="flex-1 text-xs px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 outline-none focus:border-indigo-400"
                  value={refineInstructions[feed.title] || ""}
                  onChange={(e) => onSetRefineInstructions(feed.title, e.target.value)}
                />
                <button
                  onClick={() => onRefine(feed.title, JSON.stringify(feed.parsedObj))}
                  disabled={refiningKey === feed.title}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[14px]">{refiningKey === feed.title ? 'hourglass_empty' : 'auto_fix_high'}</span>
                  {refiningKey === feed.title ? 'Refining...' : 'Refine with AI'}
                </button>
              </div>
            </>
          ) : (
            /* Complex data: delegate entirely to JsonEditor */
            renderEditableData()
          )}
        </div>
      )}
    </motion.div>
  );
}

/** Displays the extraction status badge */
function StatusBadge({ status }: { status: ExtractionFeedItem['status'] }) {
  switch (status) {
    case 'FETCHING...':
      return (
        <div className="flex items-center gap-2 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 rounded">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-pulse"></div>
          <span className="text-[10px] font-bold text-[var(--color-primary)]">EXTRACTING</span>
        </div>
      );
    case 'REFINING...':
      return (
        <div className="flex items-center gap-2 px-2 py-1 bg-amber-50 dark:bg-amber-900/20 rounded">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
          <span className="text-[10px] font-bold text-amber-500">REFINING</span>
        </div>
      );
    case 'WAITING...':
      return (
        <div className="flex items-center gap-2 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">
          <span className="material-symbols-outlined text-[12px] opacity-50 px-0.5">more_horiz</span>
          <span className="text-[10px] font-bold text-slate-500">QUEUED</span>
        </div>
      );
    case 'VALIDATING...':
      return (
        <div className="flex items-center gap-2 px-2 py-1 bg-purple-50 dark:bg-purple-900/20 rounded border border-purple-100 dark:border-purple-800">
          <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></div>
          <span className="text-[10px] font-bold text-purple-600">VALIDATING</span>
        </div>
      );
    default:
      return (
        <span className="text-[10px] font-bold text-green-600 bg-green-50 dark:bg-green-900/20 shadow-sm border border-green-200 px-2 py-1 rounded flex items-center gap-1">
          <span className="material-symbols-outlined text-[12px]">check</span> READY
        </span>
      );
  }
}
