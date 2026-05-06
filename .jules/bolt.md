## 2024-05-18 - Memoizing derived state in Dashboard
**Learning:** In the Dashboard (`src/app/page.tsx`), the `currentFetchedAnswers` derived state was recalculating on every re-render (e.g., every 100ms timer tick during extraction tasks) due to unmemoized `.filter()` and `.reduce()` operations, which block the UI thread.
**Action:** Always wrap expensive derived state computations in `useMemo` (e.g., filtering large feed arrays) and event handlers passed to child components in `useCallback` to prevent unnecessary re-renders in rapid-update environments.
