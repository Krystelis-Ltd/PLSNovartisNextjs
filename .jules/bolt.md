## 2025-02-18 - Optimized array derivation
**Learning:** React 19 / Next.js 16 components with derived array filtering/mapping operations in their render bodies trigger unnecessary re-renders.
**Action:** Always wrap `filter` and `reduce` derivations in `useMemo` when calculating lists for child props. Wrap setter functions triggering complex array manipulations in `useCallback`.
