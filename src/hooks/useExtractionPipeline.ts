'use client';

import { useState, useEffect, useCallback } from 'react';
import { EXTRACTION_BATCH_SIZE } from '@/lib/constants';
import type { ExtractionFeedItem } from '@/types';

interface UseExtractionPipelineOptions {
  vectorStoreId: string | null;
  keys: string[];
  texts: Record<string, string>;
  selectedPrompts: Record<string, boolean>;
  onToast: (msg: string, type: 'success' | 'warning' | 'error') => void;
}

export function useExtractionPipeline({
  vectorStoreId,
  keys,
  texts,
  selectedPrompts,
  onToast,
}: UseExtractionPipelineOptions) {
  const [extractionFeed, setExtractionFeed] = useState<ExtractionFeedItem[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [extractionTimeMs, setExtractionTimeMs] = useState(0);
  const [refiningKey, setRefiningKey] = useState<string | null>(null);
  const [refineInstructions, setRefineInstructions] = useState<Record<string, string>>({});

  // Timer for extraction duration
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isExtracting) {
      interval = setInterval(() => {
        setExtractionTimeMs(prev => prev + 100);
      }, 100);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isExtracting]);

  const formatTime = useCallback((ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  const runExtraction = useCallback(async () => {
    if (!vectorStoreId) {
      onToast("Please upload a file first.", 'warning');
      return;
    }

    setIsExtracting(true);
    setExtractionProgress(0);
    setExtractionTimeMs(0);
    const activeKeys = keys.filter(k => selectedPrompts[k]);

    setExtractionFeed(activeKeys.map(k => ({ title: k, status: "WAITING..." })));

    const batchSize = EXTRACTION_BATCH_SIZE;
    let completedKeys = 0;
    let accumulatedAnswers: Record<string, any> = {};

    for (let i = 0; i < activeKeys.length; i += batchSize) {
      const batch = activeKeys.slice(i, i + batchSize);

      // Update UI to show fetching for current batch
      setExtractionFeed(prev => prev.map(feed =>
        batch.includes(feed.title) ? { ...feed, status: "FETCHING..." } : feed
      ));

      const batchPrompts: Record<string, string> = {};
      batch.forEach(k => batchPrompts[k] = texts[k]);

      try {
        // === EXTRACTION ===
        const extractController = new AbortController();
        const extractTimeout = setTimeout(() => extractController.abort(), 240_000);
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batchPrompts, vectorStoreId, contextData: accumulatedAnswers }),
          signal: extractController.signal
        });
        clearTimeout(extractTimeout);
        const data = await res.json();

        let batchResults: Record<string, any> = {};
        if (res.ok && data.raw) {
          try {
            batchResults = JSON.parse(data.raw);
          } catch (e) {
            console.error("Failed to parse batch json payload", data.raw);
          }
        }

        // === REFINEMENT ===
        setExtractionFeed(prev => prev.map(feed =>
          batch.includes(feed.title) ? { ...feed, status: "REFINING..." } : feed
        ));

        let finalResultsToRender = batchResults;

        try {
          const refineController = new AbortController();
          const refineTimeout = setTimeout(() => refineController.abort(), 240_000);
          const refinePromise = await fetch('/api/refine', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rawJson: JSON.stringify(batchResults) }),
            signal: refineController.signal
          });
          clearTimeout(refineTimeout);

          const refineData = await refinePromise.json();
          if (refinePromise.ok && refineData.refinedJson) {
            try {
              const parsedRefined: Record<string, any> = JSON.parse(refineData.refinedJson);

              // Re-inject metadata since refinement agent often strips it
              for (const key of Object.keys(parsedRefined)) {
                if (batchResults[key]) {
                  if (typeof parsedRefined[key] !== 'object' || parsedRefined[key] === null) {
                    parsedRefined[key] = { data: parsedRefined[key] };
                  }
                  const metaKeys = ['confidence_score', 'source_quote', 'source_file', 'source_page', 'source_section', 'source_reasoning'];
                  for (const mKey of metaKeys) {
                    if (batchResults[key][mKey] !== undefined) {
                      parsedRefined[key][mKey] = batchResults[key][mKey];
                    }
                  }
                }
              }

              finalResultsToRender = parsedRefined;
            } catch (e) {
              console.warn("Failed to parse refined JSON payload, falling back to raw.", refineData.refinedJson);
            }
          } else {
            console.warn("Refinement API returned error, skipping refine step:", refineData.error);
          }
        } catch (refineErr) {
          console.error("Refinement API request failed, skipping refine step:", refineErr);
        }

        // === VALIDATION (tables only) ===
        const tableKeys = batch.filter(k => k.includes('table'));
        if (tableKeys.length > 0) {
          setExtractionFeed(prev => prev.map(feed =>
            tableKeys.includes(feed.title) ? { ...feed, status: "VALIDATING..." } : feed
          ));

          await Promise.all(tableKeys.map(async (key) => {
            const rawObj = (finalResultsToRender as any)[key];
            if (!rawObj || Object.keys(rawObj).length === 0) return;

            const sourceQuote = rawObj.source_quote;

            try {
              const validateController = new AbortController();
              const validateTimeout = setTimeout(() => validateController.abort(), 240_000);
              const validatePromise = await fetch('/api/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keyName: key, extractedData: rawObj, sourceQuote }),
                signal: validateController.signal
              });
              clearTimeout(validateTimeout);

              const validateData = await validatePromise.json();
              if (validatePromise.ok && validateData.validatedData) {
                const validatedObj = validateData.validatedData;
                // Preserve metadata
                const metaKeys = ['confidence_score', 'source_quote', 'source_file', 'source_page', 'source_section', 'source_reasoning'];
                for (const mKey of metaKeys) {
                  if (rawObj[mKey] !== undefined) validatedObj[mKey] = rawObj[mKey];
                }
                (finalResultsToRender as any)[key] = validatedObj;
              } else {
                console.warn(`Validation API returned error for ${key}:`, validateData.error);
              }
            } catch (valErr) {
              console.error(`Validation API request failed for ${key}:`, valErr);
            }
          }));
        }

        // === UPDATE FEED WITH RESULTS ===
        setExtractionFeed(prev => prev.map(feed => {
          if (!batch.includes(feed.title)) return feed;

          const rawFinalObj = (finalResultsToRender as any)[feed.title] || {};

          // Extract metadata before stripping
          const confidenceScore = rawFinalObj.confidence_score;
          const sourceQuote = rawFinalObj.source_quote;
          const sourceFile = rawFinalObj.source_file;
          const sourcePage = rawFinalObj.source_page;
          const sourceSection = rawFinalObj.source_section;
          const sourceReasoning = rawFinalObj.source_reasoning;

          // Clone to avoid mutating the shared reference, then strip metadata/citation keys
          const CITATION_KEYS = ['source', '_citations', 'citations', 'reasoning', 'source_reasoning', 'confidence_score', 'source_quote', 'source_file', 'source_page', 'source_section'];
          const cleanObj: Record<string, unknown> = {};
          for (const k of Object.keys(rawFinalObj)) {
            if (!CITATION_KEYS.includes(k)) {
              cleanObj[k] = rawFinalObj[k];
            }
          }

          let extractedText = "Failed to extract.";
          const dataObj = cleanObj.data !== undefined ? cleanObj.data : cleanObj;

          // Handle both primitives and objects safely
          if (dataObj !== null && dataObj !== undefined && typeof dataObj !== 'object') {
            extractedText = String(dataObj);
            accumulatedAnswers[feed.title] = dataObj;
          } else if (dataObj !== null && typeof dataObj === 'object' && Object.keys(dataObj).length > 0) {
            extractedText = JSON.stringify(dataObj, null, 2);
            Object.assign(accumulatedAnswers, dataObj);
          } else {
            extractedText = res.ok ? "AI returned empty for this key." : data.error || "Failed.";
          }

          return { ...feed, status: "COMPLETED", data: extractedText, parsedObj: dataObj, confidenceScore, sourceQuote, sourceFile, sourcePage, sourceSection, sourceReasoning };
        }));

      } catch (e) {
        console.error("Batch extraction failed:", e);
        setExtractionFeed(prev => prev.map(feed =>
          batch.includes(feed.title) ? { ...feed, status: "COMPLETED", data: "Error extracting." } : feed
        ));
      }

      completedKeys += batch.length;
      setExtractionProgress(Math.min(100, Math.round((completedKeys / activeKeys.length) * 100)));
    }

    setIsExtracting(false);
  }, [vectorStoreId, keys, texts, selectedPrompts, onToast]);

  const handleRefine = useCallback(async (key: string, rawJson: string, directInstructions?: string) => {
    if (!vectorStoreId) {
      onToast("Please upload standard reference documents to refine.", 'warning');
      return;
    }
    setRefiningKey(key);
    try {
      const res = await fetch('/api/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawJson,
          userInstructions: directInstructions || refineInstructions[key] || "",
          vectorStoreId
        })
      });
      const data = await res.json();
      if (res.ok && data.refinedJson) {
        const refinedObj = JSON.parse(data.refinedJson);
        const extractedText = typeof refinedObj === 'object' && refinedObj !== null
          ? JSON.stringify(refinedObj, null, 2)
          : String(refinedObj);
        setExtractionFeed(prev => prev.map(feed => {
          if (feed.title !== key) return feed;
          // Preserve existing metadata through refinement
          return { ...feed, data: extractedText, parsedObj: refinedObj };
        }));
      } else {
        onToast("Refinement failed.", 'error');
      }
    } catch (e) {
      console.error("Refinement error", e);
      onToast("Error during refinement.", 'error');
    } finally {
      setRefiningKey(null);
    }
  }, [vectorStoreId, refineInstructions, onToast]);

  return {
    extractionFeed,
    setExtractionFeed,
    isExtracting,
    extractionProgress,
    extractionTimeMs,
    refiningKey,
    refineInstructions,
    setRefineInstructions,
    formatTime,
    runExtraction,
    handleRefine,
  };
}
